"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { salvarUpload } from "@/lib/arquivos";
import { registrarAtividade } from "@/lib/atividade";
import { exigirConsultor } from "@/lib/auth/sessao";
import { ETAPAS_CHECKLIST, formatarCompetencia, formatarMoeda, semanasDistintas } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { dadosDoForm, moeda, textoOpcional } from "@/lib/formularios";
import { esquemaLancamento, lerDatasFaltas } from "@/lib/servicos/lancamento";

const CAMPOS = ETAPAS_CHECKLIST.map((e) => e.campo) as [string, ...string[]];

export async function alternarEtapa(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = z.object({ empregadoId: z.string(), ano: z.coerce.number(), mes: z.coerce.number(), campo: z.enum(CAMPOS), valor: z.enum(["true", "false"]) }).parse(dadosDoForm(fd));
    const valor = d.valor === "true";
    const c = await prisma.competencia.upsert({
      where: { empregadoId_ano_mes: { empregadoId: d.empregadoId, ano: d.ano, mes: d.mes } },
      create: { empregadoId: d.empregadoId, ano: d.ano, mes: d.mes, [d.campo]: valor },
      update: { [d.campo]: valor },
      include: { empregado: { select: { nome: true, clienteId: true } } },
    });
    const etapa = ETAPAS_CHECKLIST.find((e) => e.campo === d.campo)!.rotulo;
    await registrarAtividade({ usuarioId: u.id, clienteId: c.empregado.clienteId, acao: "CHECKLIST", descricao: `${formatarCompetencia(d.ano, d.mes)} ${c.empregado.nome}: "${etapa}" ${valor ? "concluída" : "desmarcada"}` });
    revalidatePath("/consultor/rotina");
    return { ok: true };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function salvarDae(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = z.object({ empregadoId: z.string(), ano: z.coerce.number(), mes: z.coerce.number(), daeValor: moeda("valor do DAE"), daeCodigo: textoOpcional }).parse(dadosDoForm(fd));
    const emp = await prisma.empregado.findUniqueOrThrow({ where: { id: d.empregadoId } });
    const arquivo = await salvarUpload(fd.get("arquivo") as File | null, { clienteId: emp.clienteId, criadoPorId: u.id });
    await prisma.competencia.upsert({
      where: { empregadoId_ano_mes: { empregadoId: d.empregadoId, ano: d.ano, mes: d.mes } },
      create: { empregadoId: d.empregadoId, ano: d.ano, mes: d.mes, daeValor: d.daeValor, daeCodigo: d.daeCodigo, daeEmitido: true, daeArquivoId: arquivo?.id, folhaLancada: true, folhaEncerrada: true },
      update: { daeValor: d.daeValor, daeCodigo: d.daeCodigo, daeEmitido: true, ...(arquivo ? { daeArquivoId: arquivo.id } : {}) },
    });
    if (arquivo) {
      await prisma.documento.create({ data: { clienteId: emp.clienteId, empregadoId: emp.id, tipo: "DAE", titulo: `DAE ${formatarCompetencia(d.ano, d.mes)}`, arquivoId: arquivo.id, hash: arquivo.sha256, competencia: formatarCompetencia(d.ano, d.mes), criadoPorId: u.id } });
    }
    await registrarAtividade({ usuarioId: u.id, clienteId: emp.clienteId, acao: "DAE_EMITIDO", descricao: `DAE ${formatarCompetencia(d.ano, d.mes)} de ${emp.nome}: ${formatarMoeda(d.daeValor)}` });
    revalidatePath("/consultor/rotina");
    return { ok: true, mensagem: "DAE registrado." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function salvarLancamentoConsultor(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = esquemaLancamento.parse(dadosDoForm(fd));
    const faltas = lerDatasFaltas(d.datasFaltas, d.ano, d.mes);
    const emp = await prisma.empregado.findUniqueOrThrow({ where: { id: d.empregadoId } });
    const dados = {
      faltasInjustificadas: faltas.length,
      semanasComFalta: semanasDistintas(faltas),
      faltasJustificadas: d.faltasJustificadas,
      atrasoMinutos: d.atrasoMinutos,
      horasExtras50: d.horasExtras50,
      horasExtras100: d.horasExtras100,
      horasNoturnas: d.horasNoturnas,
      adiantamento: d.adiantamento,
      observacoes: [d.datasFaltas ? `Faltas: ${d.datasFaltas}` : "", d.observacoes ?? ""].filter(Boolean).join(" — ") || null,
      origem: "CONSULTOR",
      enviadoPorId: u.id,
    };
    await prisma.lancamentoMensal.upsert({ where: { empregadoId_ano_mes: { empregadoId: d.empregadoId, ano: d.ano, mes: d.mes } }, create: { empregadoId: d.empregadoId, ano: d.ano, mes: d.mes, ...dados }, update: dados });
    await prisma.competencia.upsert({ where: { empregadoId_ano_mes: { empregadoId: d.empregadoId, ano: d.ano, mes: d.mes } }, create: { empregadoId: d.empregadoId, ano: d.ano, mes: d.mes, infoRecebida: true }, update: { infoRecebida: true } });
    await registrarAtividade({ usuarioId: u.id, clienteId: emp.clienteId, acao: "LANCAMENTO", descricao: `Informações de ${formatarCompetencia(d.ano, d.mes)} de ${emp.nome} lançadas pelo consultor` });
    revalidatePath("/consultor/rotina");
    return { ok: true, mensagem: "Informações salvas." };
  } catch (e) {
    return erroParaEstado(e);
  }
}
