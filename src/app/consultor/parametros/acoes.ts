"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { exigirConsultor } from "@/lib/auth/sessao";
import { definicao, formatarData, hojeBrasil, lerMoeda, validarTabela, ALIQUOTAS_PADRAO } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { dadosDoForm, dataCampo, textoOpcional } from "@/lib/formularios";
import { impactoDaMudanca } from "@/lib/servicos/parametros";

function lerValor(chave: string, fd: FormData): unknown {
  const def = definicao(chave);
  if (!def) throw new Error("Parâmetro desconhecido.");
  if (def.tipo === "faixas") {
    const faixas = [];
    for (let i = 0; i < 6; i++) {
      const ate = String(fd.get(`faixa_ate_${i}`) ?? "").trim();
      const aliq = String(fd.get(`faixa_aliq_${i}`) ?? "").trim();
      if (ate && aliq) faixas.push({ ate: lerMoeda(ate), aliquota: lerMoeda(aliq) });
    }
    const erros = validarTabela({ ano: 0, salarioMinimo: 1, faixasInss: faixas, salarioFamiliaCota: 0, salarioFamiliaLimite: 0, aliquotas: ALIQUOTAS_PADRAO, arredondamentoDae: "truncar" });
    if (erros.length) throw new Error(erros.join(" "));
    return faixas;
  }
  if (def.tipo === "texto") {
    const v = String(fd.get("valor") ?? "");
    if (chave === "DAE_ARREDONDAMENTO" && !["truncar", "arredondar"].includes(v)) throw new Error("Escolha truncar ou arredondar.");
    return v;
  }
  const n = lerMoeda(String(fd.get("valor") ?? ""));
  if (!(n >= 0)) throw new Error("Valor inválido.");
  if (def.tipo === "percentual" && n > 100) throw new Error("Percentual acima de 100%.");
  return n;
}

/** Cadastra (ou corrige) uma vigência. Cálculos de datas anteriores continuam usando o valor antigo. */
export async function salvarVigencia(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = z.object({ chave: z.string(), vigenciaInicio: dataCampo("o início da vigência"), fonteUrl: textoOpcional, observacao: textoOpcional }).parse(dadosDoForm(fd));
    if (d.fonteUrl && !/^https?:\/\//.test(d.fonteUrl)) return { erro: "A fonte deve ser um link (https://...)." };
    const valor = lerValor(d.chave, fd);
    const existente = await prisma.parametro.findUnique({ where: { chave_vigenciaInicio: { chave: d.chave, vigenciaInicio: d.vigenciaInicio } } });
    const dados = { valor: valor as object, fonteUrl: d.fonteUrl, observacao: d.observacao, ultimaConferencia: hojeBrasil(), criadoPorId: u.id };
    await prisma.parametro.upsert({ where: { chave_vigenciaInicio: { chave: d.chave, vigenciaInicio: d.vigenciaInicio } }, create: { chave: d.chave, vigenciaInicio: d.vigenciaInicio, ...dados }, update: dados });
    const rotulo = definicao(d.chave)!.rotulo;
    await registrarAtividade({ usuarioId: u.id, acao: "PARAMETRO", descricao: `${rotulo}: ${existente ? "vigência corrigida" : "nova vigência"} a partir de ${formatarData(d.vigenciaInicio)} (${JSON.stringify(valor)}${existente ? `; antes ${JSON.stringify(existente.valor)}` : ""})` });
    const impactos = await impactoDaMudanca(d.chave, d.vigenciaInicio);
    revalidatePath("/", "layout");
    return {
      ok: true,
      mensagem: `${rotulo} salvo a partir de ${formatarData(d.vigenciaInicio)}. Todos os cálculos e simulações já usam o novo valor nessa data. ${impactos.length ? `${impactos.length} empregado(s) afetado(s) — veja abaixo e avise os clientes.` : "Nenhum cliente afetado."}`,
      dados: { impactos, vigencia: d.vigenciaInicio.toISOString().slice(0, 10) },
    };
  } catch (e) {
    return erroParaEstado(e);
  }
}

/** Confirma que o valor vigente foi conferido na fonte oficial. */
export async function marcarConferido(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  const chave = String(fd.get("chave"));
  const hoje = hojeBrasil();
  const vigente = await prisma.parametro.findFirst({ where: { chave, vigenciaInicio: { lte: hoje } }, orderBy: { vigenciaInicio: "desc" } });
  if (!vigente) return { erro: "Cadastre o valor vigente primeiro." };
  await prisma.parametro.update({ where: { id: vigente.id }, data: { ultimaConferencia: hoje } });
  const url = vigente.fonteUrl ?? definicao(chave)?.fonte;
  if (url) await prisma.fonteOficial.updateMany({ where: { url }, data: { mudouEm: null } });
  await registrarAtividade({ usuarioId: u.id, acao: "PARAMETRO", descricao: `${definicao(chave)?.rotulo} conferido na fonte oficial` });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function excluirVigencia(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  const p = await prisma.parametro.findUniqueOrThrow({ where: { id: String(fd.get("id")) } });
  if ((await prisma.parametro.count({ where: { chave: p.chave } })) <= 1) return { erro: "Não é possível excluir a única vigência." };
  await prisma.parametro.delete({ where: { id: p.id } });
  await registrarAtividade({ usuarioId: u.id, acao: "PARAMETRO", descricao: `${definicao(p.chave)?.rotulo}: vigência de ${formatarData(p.vigenciaInicio)} excluída (${JSON.stringify(p.valor)})` });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Envia aos clientes afetados, pelo chat, a explicação da mudança. */
export async function avisarClientes(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = z.object({ chave: z.string(), vigenciaInicio: dataCampo("a vigência") }).parse(dadosDoForm(fd));
    const impactos = await impactoDaMudanca(d.chave, d.vigenciaInicio);
    for (const i of impactos) {
      await prisma.mensagem.create({ data: { clienteId: i.clienteId, autorId: u.id, texto: i.mensagem } });
      await registrarAtividade({ usuarioId: u.id, clienteId: i.clienteId, acao: "AVISO_PARAMETRO", descricao: `Cliente avisado da mudança: ${definicao(d.chave)?.rotulo} (${i.empregado})` });
    }
    revalidatePath("/consultor/mensagens");
    return { ok: true, mensagem: `${impactos.length} aviso(s) enviado(s) pelo chat.` };
  } catch (e) {
    return erroParaEstado(e);
  }
}
