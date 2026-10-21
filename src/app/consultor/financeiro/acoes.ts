"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { exigirConsultor } from "@/lib/auth/sessao";
import { data, diasNoMes, formatarCompetencia, formatarMoeda, hojeBrasil } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { dadosDoForm, dataCampo, dataOpcional, moeda, texto } from "@/lib/formularios";

/** Gera as mensalidades do mês para todos os clientes ativos (não duplica). */
export async function gerarMensalidades(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  const [ano, mes] = String(fd.get("competencia") ?? "").split("-").map(Number);
  if (!ano || !mes) return { erro: "Informe o mês." };
  const clientes = await prisma.cliente.findMany({ where: { ativo: true, anonimizadoEm: null } });
  let criadas = 0;
  for (const c of clientes) {
    const existe = await prisma.mensalidade.findUnique({ where: { clienteId_ano_mes: { clienteId: c.id, ano, mes } } });
    if (existe) continue;
    await prisma.mensalidade.create({ data: { clienteId: c.id, ano, mes, valor: c.mensalidade, vencimento: data(ano, mes, Math.min(c.diaVencimento, diasNoMes(ano, mes))), txid: `MENS${ano}${String(mes).padStart(2, "0")}${c.id.slice(-6).toUpperCase()}` } });
    criadas++;
  }
  await registrarAtividade({ usuarioId: u.id, acao: "MENSALIDADES", descricao: `${criadas} mensalidade(s) de ${formatarCompetencia(ano, mes)} geradas` });
  revalidatePath("/consultor/financeiro");
  return { ok: true, mensagem: `${criadas} mensalidade(s) gerada(s).` };
}

export async function baixarMensalidade(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = z.object({ id: z.string(), forma: z.string().default("Pix"), pagoEm: dataOpcional }).parse(dadosDoForm(fd));
    const m = await prisma.mensalidade.update({ where: { id: d.id }, data: { status: "PAGO", pagoEm: d.pagoEm ?? hojeBrasil(), formaPagamento: d.forma } });
    await registrarAtividade({ usuarioId: u.id, clienteId: m.clienteId, acao: "MENSALIDADE_PAGA", descricao: `Mensalidade ${formatarCompetencia(m.ano, m.mes)} paga (${d.forma})` });
    revalidatePath("/consultor/financeiro");
    return { ok: true };
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
