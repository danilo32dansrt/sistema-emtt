import "server-only";
import { createHash } from "node:crypto";
import type { Parametro } from "@prisma/client";
import {
  DEFINICOES_PARAMETROS, PARAMETROS_PADRAO, calcularFolhaMensal, formatarData, formatarMoeda, hojeBrasil, parametrosSemConferencia,
  salarioMinimoProporcional, tabelaNaData, type RegistroParametro,
} from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";

export const MESES_CONFERENCIA = 6;

/** Situação de cada parâmetro: valor vigente, histórico, fonte e conferência. */
export async function situacaoParametros(hoje = hojeBrasil()) {
  const registros = await prisma.parametro.findMany({ orderBy: [{ chave: "asc" }, { vigenciaInicio: "desc" }] });
  const fontes = await prisma.fonteOficial.findMany();
  return DEFINICOES_PARAMETROS.map((def) => {
    const historico = registros.filter((r) => r.chave === def.chave);
    const vigente = historico.find((r) => r.vigenciaInicio <= hoje) ?? null;
    const futuro = historico.find((r) => r.vigenciaInicio > hoje) ?? null;
    const padrao = PARAMETROS_PADRAO.filter((p) => p.chave === def.chave).sort((a, b) => b.vigenciaInicio.getTime() - a.vigenciaInicio.getTime())[0];
    const pendente = parametrosSemConferencia([{ chave: def.chave, ultimaConferencia: vigente?.ultimaConferencia ?? null }], hoje, MESES_CONFERENCIA).length > 0;
    const fonteUrl = vigente?.fonteUrl ?? def.fonte;
    const fonte = fontes.find((f) => f.url === fonteUrl);
    return { def, historico, vigente, futuro, padrao, pendente, fonteUrl, fonteMudou: Boolean(fonte?.mudouEm) };
  });
}

export async function quantidadeParametrosPendentes() {
  const s = await situacaoParametros();
  return s.filter((x) => x.pendente || x.fonteMudou || !x.vigente).length;
}

function registros(lista: Parametro[]): RegistroParametro[] {
  const doBanco = lista.map((p) => ({ chave: p.chave, valor: p.valor, vigenciaInicio: p.vigenciaInicio }));
  return [...doBanco, ...PARAMETROS_PADRAO.filter((p) => !doBanco.some((b) => b.chave === p.chave))];
}

export interface Impacto {
  clienteId: string;
  cliente: string;
  empregado: string;
  antes: string;
  depois: string;
  mensagem: string;
}

/**
 * Quem é afetado por uma nova vigência: compara o cálculo com e sem a mudança
 * na data de início (salário abaixo do novo mínimo, DAE estimado diferente).
 */
export async function impactoDaMudanca(chave: string, vigencia: Date): Promise<Impacto[]> {
  const todos = await prisma.parametro.findMany();
  const sem = registros(todos.filter((p) => !(p.chave === chave && p.vigenciaInicio.getTime() === vigencia.getTime())));
  const com = registros(todos);
  let tabAntes, tabDepois;
  try {
    tabAntes = tabelaNaData(sem, vigencia);
    tabDepois = tabelaNaData(com, vigencia);
  } catch {
    return [];
  }
  const empregados = await prisma.empregado.findMany({ where: { situacao: { not: "DESLIGADO" }, cliente: { ativo: true, anonimizadoEm: null } }, include: { cliente: { select: { id: true, nome: true } } } });
  const impactos: Impacto[] = [];
  const ano = vigencia.getUTCFullYear();
  const mes = vigencia.getUTCMonth() + 1;
  for (const e of empregados) {
    const salario = num(e.salario);
    const horas = num(e.horasSemanais);
    if (chave === "SALARIO_MINIMO") {
      const minimo = salarioMinimoProporcional(tabDepois.salarioMinimo, e.regime === "DOZE_X_TRINTA_SEIS" ? 44 : horas);
      if (salario + 0.004 < minimo) {
        impactos.push({
          clienteId: e.cliente.id, cliente: e.cliente.nome, empregado: e.nome, antes: formatarMoeda(salario), depois: formatarMoeda(minimo),
          mensagem: `Olá! A partir de ${formatarData(vigencia)} o salário mínimo passa a ${formatarMoeda(tabDepois.salarioMinimo)}. O salário de ${e.nome.split(" ")[0]} (${formatarMoeda(salario)}) precisa subir para pelo menos ${formatarMoeda(minimo)} (mínimo proporcional à jornada de ${horas}h). Vou atualizar no eSocial — qualquer dúvida, me chame.`,
        });
      }
      continue;
    }
    if (["BF_", "BPC_"].some((p) => chave.startsWith(p))) continue;
    const base = { ano, mes, salario, horasSemanais: horas, admissao: e.admissao, desligamento: e.desligamento, dependentesSalarioFamilia: e.dependentesSalarioFamilia };
    const a = calcularFolhaMensal({ ...base, tabela: tabAntes });
    const b = calcularFolhaMensal({ ...base, tabela: tabDepois });
    if (Math.abs(a.encargos.totalDae - b.encargos.totalDae) >= 0.01 || Math.abs(a.liquido - b.liquido) >= 0.01) {
      impactos.push({
        clienteId: e.cliente.id, cliente: e.cliente.nome, empregado: e.nome, antes: `DAE ${formatarMoeda(a.encargos.totalDae)}`, depois: `DAE ${formatarMoeda(b.encargos.totalDae)}`,
        mensagem: `Olá! A partir de ${formatarData(vigencia)} houve mudança nos valores oficiais (${DEFINICOES_PARAMETROS.find((d) => d.chave === chave)?.rotulo}). O DAE estimado de ${e.nome.split(" ")[0]} passa de ${formatarMoeda(a.encargos.totalDae)} para ${formatarMoeda(b.encargos.totalDae)} e o líquido de ${formatarMoeda(a.liquido)} para ${formatarMoeda(b.liquido)}.`,
      });
    }
  }
  return impactos;
}

/**
 * Verificação opcional das páginas oficiais: guarda um resumo (hash) do texto de cada
 * fonte e marca quando mudou. Nada é alterado automaticamente — o consultor confere e confirma.
 */
export async function verificarFontesOficiais() {
  const situacao = await situacaoParametros();
  const urls = [...new Set(situacao.map((s) => s.fonteUrl).filter((u) => /^https:\/\/(www\.)?(gov\.br|planalto\.gov\.br)\//.test(u)))];
  let mudaram = 0;
  for (const url of urls) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0 (verificador de parametros)" } });
      const html = await resp.text();
      const texto = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/\d{2}\/\d{2}\/\d{4} \d{2}h\d{2}/g, "").trim();
      const hash = createHash("sha256").update(texto).digest("hex");
      const atual = await prisma.fonteOficial.findUnique({ where: { url } });
      if (!atual) await prisma.fonteOficial.create({ data: { url, hash, verificadaEm: new Date() } });
      else {
        const mudou = Boolean(atual.hash && atual.hash !== hash);
        if (mudou) mudaram++;
        await prisma.fonteOficial.update({ where: { url }, data: { hash, verificadaEm: new Date(), erro: null, ...(mudou ? { mudouEm: new Date() } : {}) } });
      }
    } catch (e) {
      await prisma.fonteOficial.upsert({ where: { url }, create: { url, erro: String(e).slice(0, 200), verificadaEm: new Date() }, update: { erro: String(e).slice(0, 200), verificadaEm: new Date() } });
    }
  }
  return { verificadas: urls.length, mudaram };
}
