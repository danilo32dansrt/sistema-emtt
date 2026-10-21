"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { salvarUpload } from "@/lib/arquivos";
import { registrarAtividade } from "@/lib/atividade";
import { exigirCliente } from "@/lib/auth/sessao";
import { formatarCompetencia, semanasDistintas } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { dadosDoForm } from "@/lib/formularios";
import { esquemaLancamento, lerDatasFaltas } from "@/lib/servicos/lancamento";

async function empregadoDoCliente(clienteId: string, empregadoId: string) {
  const e = await prisma.empregado.findFirst({ where: { id: empregadoId, clienteId } });
  if (!e) throw new Error("Empregado não encontrado.");
  return e;
}

export async function informarMes(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirCliente();
  try {
    const d = esquemaLancamento.parse(dadosDoForm(fd));
    const e = await empregadoDoCliente(u.clienteId, d.empregadoId);
    const comp = await prisma.competencia.findUnique({ where: { empregadoId_ano_mes: { empregadoId: e.id, ano: d.ano, mes: d.mes } } });
    if (comp?.folhaEncerrada) return { erro: "A folha deste mês já foi encerrada. Fale com o consultor pelo chat." };
    const faltas = lerDatasFaltas(d.datasFaltas, d.ano, d.mes);
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
      origem: "CLIENTE",
      enviadoPorId: u.id,
      enviadoEm: new Date(),
    };
    await prisma.lancamentoMensal.upsert({ where: { empregadoId_ano_mes: { empregadoId: e.id, ano: d.ano, mes: d.mes } }, create: { empregadoId: e.id, ano: d.ano, mes: d.mes, ...dados }, update: dados });
    await prisma.competencia.upsert({ where: { empregadoId_ano_mes: { empregadoId: e.id, ano: d.ano, mes: d.mes } }, create: { empregadoId: e.id, ano: d.ano, mes: d.mes, infoRecebida: true }, update: { infoRecebida: true } });
    await registrarAtividade({ usuarioId: u.id, clienteId: u.clienteId, acao: "INFORMACOES_MES", descricao: `Cliente informou ${formatarCompetencia(d.ano, d.mes)} de ${e.nome}` });
    revalidatePath("/cliente");
    return { ok: true, mensagem: "Informações enviadas ao consultor. Obrigado!" };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function informarPagamentoDae(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirCliente();
  try {
    const d = z.object({ empregadoId: z.string(), ano: z.coerce.number(), mes: z.coerce.number() }).parse(dadosDoForm(fd));
    const e = await empregadoDoCliente(u.clienteId, d.empregadoId);
    const arquivo = await salvarUpload(fd.get("comprovante") as File | null, { clienteId: u.clienteId, criadoPorId: u.id });
    await prisma.competencia.upsert({
      where: { empregadoId_ano_mes: { empregadoId: e.id, ano: d.ano, mes: d.mes } },
      create: { empregadoId: e.id, ano: d.ano, mes: d.mes, clienteInformouPagamentoEm: new Date(), comprovanteArquivoId: arquivo?.id },
      update: { clienteInformouPagamentoEm: new Date(), ...(arquivo ? { comprovanteArquivoId: arquivo.id } : {}) },
    });
    if (arquivo) {
      await prisma.documento.create({ data: { clienteId: u.clienteId, empregadoId: e.id, tipo: "COMPROVANTE", titulo: `Comprovante DAE ${formatarCompetencia(d.ano, d.mes)}`, arquivoId: arquivo.id, hash: arquivo.sha256, competencia: formatarCompetencia(d.ano, d.mes), criadoPorId: u.id } });
    }
    await registrarAtividade({ usuarioId: u.id, clienteId: u.clienteId, acao: "DAE_PAGO_CLIENTE", descricao: `Cliente informou pagamento do DAE ${formatarCompetencia(d.ano, d.mes)} (${e.nome})${arquivo ? " com comprovante" : ""}` });
    revalidatePath("/cliente/dae");
    return { ok: true, mensagem: "Pagamento informado. O consultor vai conferir e confirmar." };
  } catch (e) {
    return erroParaEstado(e);
  }
}
