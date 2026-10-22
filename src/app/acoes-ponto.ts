"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { exigirPapel } from "@/lib/auth/sessao";
import { formatarCompetencia, formatarData } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { avisarEmpregada } from "@/lib/notificacoes";
import { fecharMesPeloPonto } from "@/lib/servicos/ponto";

/** Consultor ou empregador (só dos próprios empregados) decide ajustes e justificativas. Nunca apaga marcações. */
async function autorizar(empregadoId: string) {
  const u = await exigirPapel("CONSULTOR", "CLIENTE");
  const emp = await prisma.empregado.findUniqueOrThrow({ where: { id: empregadoId } });
  if (u.papel === "CLIENTE" && emp.clienteId !== u.clienteId) throw new Error("Sem permissão.");
  return { u, emp };
}

export async function decidirAjuste(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  try {
    const d = z.object({ id: z.string(), decisao: z.enum(["APROVADO", "REJEITADO"]), motivo: z.string().optional() }).parse({ id: fd.get("id"), decisao: fd.get("decisao"), motivo: fd.get("motivo") ?? undefined });
    const ajuste = await prisma.ajustePonto.findUniqueOrThrow({ where: { id: d.id } });
    const { u, emp } = await autorizar(ajuste.empregadoId);
    if (ajuste.status !== "PENDENTE") return { erro: "Este pedido já foi decidido." };
    await prisma.ajustePonto.update({ where: { id: d.id }, data: { status: d.decisao, decididoPorId: u.id, decididoEm: new Date(), motivoDecisao: d.motivo || null } });
    await registrarAtividade({ usuarioId: u.id, clienteId: emp.clienteId, acao: "AJUSTE_DECIDIDO", descricao: `Ajuste de ponto de ${emp.nome} em ${formatarData(ajuste.data)} ${d.decisao === "APROVADO" ? "aprovado" : "rejeitado"}` });
    await avisarEmpregada(emp.id, { chave: `ajuste-decidido:${ajuste.id}`, titulo: d.decisao === "APROVADO" ? "Ajuste do ponto aprovado" : "Ajuste do ponto não aprovado", texto: `Dia ${formatarData(ajuste.data)}.${d.motivo ? ` Motivo: ${d.motivo}` : d.decisao === "REJEITADO" ? " Vale o registro do empregador." : ""}`, link: "/ponto/historico" });
    revalidatePath("/consultor/ponto");
    revalidatePath("/cliente/ponto");
    return { ok: true };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function decidirJustificativa(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  try {
    const d = z.object({ id: z.string(), decisao: z.enum(["APROVADO", "REJEITADO"]) }).parse({ id: fd.get("id"), decisao: fd.get("decisao") });
    const j = await prisma.justificativa.findUniqueOrThrow({ where: { id: d.id } });
    const { u, emp } = await autorizar(j.empregadoId);
    if (j.status !== "PENDENTE") return { erro: "Este pedido já foi decidido." };
    await prisma.justificativa.update({ where: { id: d.id }, data: { status: d.decisao, decididoPorId: u.id, decididoEm: new Date() } });
    await registrarAtividade({ usuarioId: u.id, clienteId: emp.clienteId, acao: "JUSTIFICATIVA_DECIDIDA", descricao: `Justificativa de ${emp.nome} (${formatarData(j.data)}) ${d.decisao === "APROVADO" ? "aceita" : "recusada"}` });
    await avisarEmpregada(emp.id, { chave: `justificativa-decidida:${j.id}`, titulo: d.decisao === "APROVADO" ? "Justificativa aceita" : "Justificativa não aceita", texto: `Dia ${formatarData(j.data)}. ${d.decisao === "APROVADO" ? "O dia não será descontado." : "O dia segue o registro do empregador."}`, link: "/ponto/justificativas" });
    revalidatePath("/consultor/ponto");
    revalidatePath("/cliente/ponto");
    return { ok: true };
  } catch (e) {
    return erroParaEstado(e);
  }
}

/** Gera as informações do mês (rubricas) a partir do ponto, para lançar na folha do eSocial. */
export async function gerarLancamentoDoPonto(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  try {
    const d = z.object({ empregadoId: z.string(), ano: z.coerce.number(), mes: z.coerce.number() }).parse({ empregadoId: fd.get("empregadoId"), ano: fd.get("ano"), mes: fd.get("mes") });
    const { u, emp } = await autorizar(d.empregadoId);
    await fecharMesPeloPonto(emp, d.ano, d.mes, u.id);
    await registrarAtividade({ usuarioId: u.id, clienteId: emp.clienteId, acao: "LANCAMENTO_PONTO", descricao: `Informações de ${formatarCompetencia(d.ano, d.mes)} de ${emp.nome} geradas a partir do ponto` });
    revalidatePath("/consultor/rotina");
    return { ok: true, mensagem: "Informações do mês geradas a partir do ponto e enviadas para a rotina mensal." };
  } catch (e) {
    return erroParaEstado(e);
  }
}
