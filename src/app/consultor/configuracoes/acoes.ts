"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { exigirConsultor } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { checkbox, dadosDoForm, moeda, numero, texto, textoOpcional } from "@/lib/formularios";
import { configInter, consultarWebhook, ErroInter, registrarWebhook } from "@/lib/inter/api";

export async function salvarConfiguracao(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = z.object({
      nomeConsultoria: texto("o nome da consultoria"),
      documento: textoOpcional, telefone: textoOpcional, email: textoOpcional, endereco: textoOpcional, cidade: textoOpcional, uf: textoOpcional,
      chavePix: textoOpcional, nomePix: textoOpcional, cidadePix: textoOpcional,
      regraFeriasParcial: z.enum(["CLT", "LC150"]),
    }).parse(dadosDoForm(fd));
    await prisma.configuracao.upsert({ where: { id: "principal" }, create: { id: "principal", ...d }, update: d });
    await registrarAtividade({ usuarioId: u.id, acao: "CONFIGURACAO", descricao: "Configurações da consultoria alteradas" });
    revalidatePath("/consultor/configuracoes");
    return { ok: true, mensagem: "Configurações salvas." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function salvarPreco(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  try {
    const d = z.object({ servico: texto("o serviço"), descricao: textoOpcional, valor: moeda("valor"), unidade: z.enum(["mensal", "por_empregado", "avulso"]) }).parse(dadosDoForm(fd));
    await prisma.tabelaPreco.upsert({ where: { servico: d.servico }, create: d, update: { ...d, ativo: true } });
    revalidatePath("/consultor/configuracoes");
    return { ok: true, mensagem: "Preço salvo." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function removerPreco(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  await prisma.tabelaPreco.update({ where: { id: String(fd.get("id")) }, data: { ativo: false } });
  revalidatePath("/consultor/configuracoes");
  return { ok: true };
}

export async function salvarModelo(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  try {
    const d = z.object({ chave: texto("a chave"), titulo: texto("o título"), texto: texto("o texto") }).parse(dadosDoForm(fd));
    await prisma.modeloMensagem.upsert({ where: { chave: d.chave }, create: d, update: d });
    revalidatePath("/consultor/configuracoes");
    return { ok: true, mensagem: "Modelo salvo." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function salvarCobrancaInter(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = z.object({ cobrancaInter: checkbox, multaMensalidade: numero("a multa", 0, 10), jurosMensalidade: numero("os juros", 0, 10), diasBaixaInter: numero("os dias para baixa", 0, 60) }).parse(dadosDoForm(fd));
    if (d.cobrancaInter && !configInter().configurado) return { erro: `Antes de ligar, coloque as credenciais do Inter no .env (faltam: ${configInter().faltando.join(", ")}).` };
    const dados = { ...d, diasBaixaInter: Math.trunc(d.diasBaixaInter) };
    await prisma.configuracao.upsert({ where: { id: "principal" }, create: { id: "principal", ...dados }, update: dados });
    await registrarAtividade({ usuarioId: u.id, acao: "CONFIGURACAO", descricao: `Cobrança automática pelo Inter ${d.cobrancaInter ? "ligada" : "desligada"}` });
    revalidatePath("/consultor/configuracoes");
    revalidatePath("/consultor/financeiro");
    return { ok: true, mensagem: "Cobrança automática salva." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

/** Confere credenciais e certificado pedindo um token e lendo o webhook cadastrado no banco. */
export async function testarConexaoInter(): Promise<EstadoAcao> {
  await exigirConsultor();
  try {
    const w = await consultarWebhook().catch((e: unknown) => (e instanceof ErroInter && e.status === 404 ? null : Promise.reject(e)));
    return { ok: true, mensagem: `Conexão com o Inter funcionando (${configInter().ambiente === "producao" ? "produção" : "testes"}). ${w ? "Aviso de pagamento cadastrado." : "Falta cadastrar o aviso de pagamento (webhook)."}` };
  } catch (e) {
    return erroParaEstado(e);
  }
}

/** Cadastra no Inter o endereço que recebe o aviso de pagamento (precisa de APP_URL com https e INTER_WEBHOOK_TOKEN). */
export async function cadastrarWebhookInter(): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  const app = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const tokenWebhook = process.env.INTER_WEBHOOK_TOKEN ?? "";
  if (!app.startsWith("https://")) return { erro: "O APP_URL precisa ser o endereço público com https (ex.: https://seusistema.vercel.app)." };
  if (tokenWebhook.length < 16) return { erro: "Defina INTER_WEBHOOK_TOKEN no .env com pelo menos 16 caracteres (gere com: openssl rand -hex 24)." };
  try {
    await registrarWebhook(`${app}/api/inter/webhook?token=${encodeURIComponent(tokenWebhook)}`);
    await registrarAtividade({ usuarioId: u.id, acao: "CONFIGURACAO", descricao: "Aviso de pagamento (webhook) cadastrado no Inter" });
    return { ok: true, mensagem: "Aviso de pagamento cadastrado no Inter." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function salvarPlanos(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const opcional = z.string().trim().transform((v) => (v ? v : null)).pipe(z.string().nullable());
    const d = z.object({ precoBasico: opcional, precoMedio: opcional, precoPlus: opcional, diaVencimentoPlus: numero("o dia de vencimento do Plus", 1, 6), pagamentoDaeInter: checkbox }).parse(dadosDoForm(fd));
    const valor = (v: string | null, rotulo: string) => {
      if (v === null) return null;
      const n = Number(v.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(n) || n < 0) throw new Error(`Valor inválido em ${rotulo}.`);
      return n;
    };
    if (d.pagamentoDaeInter && !configInter().configurado) return { erro: "Para pagar o DAE pelo Inter, coloque antes as credenciais do Inter no .env." };
    const dados = { precoBasico: valor(d.precoBasico, "Básico"), precoMedio: valor(d.precoMedio, "Médio"), precoPlus: valor(d.precoPlus, "Plus"), diaVencimentoPlus: Math.trunc(d.diaVencimentoPlus), pagamentoDaeInter: d.pagamentoDaeInter };
    await prisma.configuracao.upsert({ where: { id: "principal" }, create: { id: "principal", ...dados }, update: dados });
    await registrarAtividade({ usuarioId: u.id, acao: "CONFIGURACAO", descricao: "Planos e plano Plus alterados" });
    revalidatePath("/consultor/configuracoes");
    return { ok: true, mensagem: "Planos salvos." };
  } catch (e) {
    return erroParaEstado(e);
  }
}
