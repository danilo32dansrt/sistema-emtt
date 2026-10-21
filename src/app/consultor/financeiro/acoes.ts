"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { exigirConsultor } from "@/lib/auth/sessao";
import { data, diasNoMes, formatarCompetencia, formatarMoeda, hojeBrasil } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { dadosDoForm, dataCampo, dataOpcional, moeda, texto } from "@/lib/formularios";
import { configInter, pagarCobrancaSandbox } from "@/lib/inter/api";
import { ROTULOS_SITUACAO_INTER } from "@/lib/inter/regras";
import { cancelarCobrancaMensalidade, cobrancaInterAtiva, emitirCobrancaMensalidade, sincronizarMensalidade } from "@/lib/servicos/cobranca-inter";

/** Gera as mensalidades do mês para todos os clientes ativos (não duplica). */
export async function gerarMensalidades(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  const [ano, mes] = String(fd.get("competencia") ?? "").split("-").map(Number);
  if (!ano || !mes) return { erro: "Informe o mês." };
  const clientes = await prisma.cliente.findMany({ where: { ativo: true, anonimizadoEm: null } });
  let criadas = 0;
  const novas: string[] = [];
  for (const c of clientes) {
    const existe = await prisma.mensalidade.findUnique({ where: { clienteId_ano_mes: { clienteId: c.id, ano, mes } } });
    if (existe) continue;
    const nova = await prisma.mensalidade.create({ data: { clienteId: c.id, ano, mes, valor: c.mensalidade, vencimento: data(ano, mes, Math.min(c.diaVencimento, diasNoMes(ano, mes))), txid: `MENS${ano}${String(mes).padStart(2, "0")}${c.id.slice(-6).toUpperCase()}` } });
    novas.push(nova.id);
    criadas++;
  }
  await registrarAtividade({ usuarioId: u.id, acao: "MENSALIDADES", descricao: `${criadas} mensalidade(s) de ${formatarCompetencia(ano, mes)} geradas` });
  let emitidas = 0;
  if (novas.length && (await cobrancaInterAtiva())) {
    for (const id of novas) emitidas += await emitirCobrancaMensalidade(id, u.id).then(() => 1, () => 0);
  }
  revalidatePath("/consultor/financeiro");
  return { ok: true, mensagem: `${criadas} mensalidade(s) gerada(s).${emitidas ? ` ${emitidas} cobrança(s) emitida(s) no Inter.` : ""}` };
}

export async function baixarMensalidade(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = z.object({ id: z.string(), forma: z.string().default("Pix"), pagoEm: dataOpcional }).parse(dadosDoForm(fd));
    // Baixa manual: cancela antes a cobrança ainda pagável no Inter, para a cliente não pagar duas vezes
    let aviso = "";
    try {
      if (await cancelarCobrancaMensalidade(d.id, "Pago por outro meio")) aviso = " A cobrança no Inter foi cancelada.";
    } catch (e) {
      return { erro: `Não consegui cancelar a cobrança no Inter (${e instanceof Error ? e.message : "erro"}). Tente de novo antes de dar baixa manual.` };
    }
    const m = await prisma.mensalidade.update({ where: { id: d.id }, data: { status: "PAGO", pagoEm: d.pagoEm ?? hojeBrasil(), formaPagamento: d.forma } });
    await registrarAtividade({ usuarioId: u.id, clienteId: m.clienteId, acao: "MENSALIDADE_PAGA", descricao: `Mensalidade ${formatarCompetencia(m.ano, m.mes)} paga (${d.forma})` });
    revalidatePath("/consultor/financeiro");
    return { ok: true, mensagem: `Baixa feita.${aviso}` };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function reabrirMensalidade(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  await prisma.mensalidade.update({ where: { id: String(fd.get("id")) }, data: { status: "ABERTO", pagoEm: null, formaPagamento: null } });
  revalidatePath("/consultor/financeiro");
  return { ok: true };
}

export async function salvarServico(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = z.object({ clienteId: z.string().min(1, "Escolha o cliente."), tipo: z.enum(["REGULARIZACAO", "RESCISAO", "ADMISSAO", "OUTRO"]), descricao: texto("a descrição"), valor: moeda("valor"), data: dataCampo("a data") }).parse(dadosDoForm(fd));
    await prisma.servicoAvulso.create({ data: d });
    await registrarAtividade({ usuarioId: u.id, clienteId: d.clienteId, acao: "SERVICO_AVULSO", descricao: `Serviço avulso: ${d.descricao} (${formatarMoeda(d.valor)})` });
    revalidatePath("/consultor/financeiro");
    return { ok: true, mensagem: "Serviço lançado." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function baixarServico(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  await prisma.servicoAvulso.update({ where: { id: String(fd.get("id")) }, data: { status: "PAGO", pagoEm: hojeBrasil(), formaPagamento: "Pix" } });
  revalidatePath("/consultor/financeiro");
  return { ok: true };
}

export async function emitirCobrancaInter(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const m = await emitirCobrancaMensalidade(String(fd.get("id")), u.id);
    revalidatePath("/consultor/financeiro");
    return { ok: true, mensagem: `Cobrança enviada ao Inter (${ROTULOS_SITUACAO_INTER[m.interSituacao ?? ""] ?? "processando"}).` };
  } catch (e) {
    revalidatePath("/consultor/financeiro");
    // O motivo fica gravado na mensalidade e aparece logo acima do botão
    const m = await prisma.mensalidade.findUnique({ where: { id: String(fd.get("id")) }, select: { interErro: true } });
    return m?.interErro ? { erro: "Não emitida." } : erroParaEstado(e);
  }
}

export async function atualizarCobrancaInter(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  try {
    const r = await sincronizarMensalidade(String(fd.get("id")));
    revalidatePath("/consultor/financeiro");
    return { ok: true, mensagem: r.pagaAgora ? "Pagamento confirmado pelo banco." : `Situação no banco: ${ROTULOS_SITUACAO_INTER[r.mensalidade.interSituacao ?? ""] ?? "—"}.` };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function cancelarCobrancaInter(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const id = String(fd.get("id"));
    if (!(await cancelarCobrancaMensalidade(id, "Cancelada pelo consultor"))) return { erro: "Não há cobrança em aberto no Inter para cancelar." };
    const m = await prisma.mensalidade.findUniqueOrThrow({ where: { id } });
    await registrarAtividade({ usuarioId: u.id, clienteId: m.clienteId, acao: "COBRANCA_INTER", descricao: `Cobrança da mensalidade ${formatarCompetencia(m.ano, m.mes)} cancelada no Inter` });
    revalidatePath("/consultor/financeiro");
    return { ok: true, mensagem: "Cobrança cancelada no Inter." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

/** Só no ambiente de testes do Inter: simula o pagamento para conferir a baixa automática. */
export async function simularPagamentoInter(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  if (configInter().ambiente !== "sandbox") return { erro: "Simulação disponível apenas no ambiente de testes." };
  try {
    const m = await prisma.mensalidade.findUniqueOrThrow({ where: { id: String(fd.get("id")) } });
    if (!m.interCodigo) return { erro: "Emita a cobrança primeiro." };
    await pagarCobrancaSandbox(m.interCodigo, fd.get("forma") === "BOLETO" ? "BOLETO" : "PIX");
    const r = await sincronizarMensalidade(m.id);
    revalidatePath("/consultor/financeiro");
    return { ok: true, mensagem: r.pagaAgora ? "Pagamento simulado e baixa automática feita." : "Pagamento simulado; o banco ainda está processando — clique em Atualizar em instantes." };
  } catch (e) {
    return erroParaEstado(e);
  }
}
