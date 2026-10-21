"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { salvarUpload } from "@/lib/arquivos";
import { registrarAtividade } from "@/lib/atividade";
import { exigirEmpregado } from "@/lib/auth/sessao";
import { formatarData, instanteLocal } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { dadosDoForm, dataCampo, dataOpcional, texto } from "@/lib/formularios";
import { avisarPatroes } from "@/lib/notificacoes";

export async function aceitarPrivacidade(): Promise<void> {
  const u = await exigirEmpregado();
  await prisma.usuario.update({ where: { id: u.id }, data: { consentimentoLgpdEm: new Date() } });
  await registrarAtividade({ usuarioId: u.id, clienteId: u.clienteId, acao: "CIENCIA_LGPD", descricao: `${u.nome} registrou ciência do aviso de privacidade do ponto` });
  revalidatePath("/ponto");
}

export async function enviarJustificativa(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirEmpregado();
  try {
    const d = z.object({
      tipo: z.enum(["ATESTADO_MEDICO", "CASAMENTO", "FALECIMENTO_FAMILIAR", "DOACAO_SANGUE", "VIAGEM", "FOLGA_COMPENSATORIA", "OUTRO"]),
      data: dataCampo("a data"),
      dataFim: dataOpcional,
      descricao: texto("a descrição"),
    }).parse(dadosDoForm(fd));
    if (d.dataFim && d.dataFim < d.data) return { erro: "A data final é anterior à inicial." };
    const arquivo = await salvarUpload(fd.get("anexo") as File | null, { clienteId: u.clienteId, criadoPorId: u.id, obrigatorio: d.tipo === "ATESTADO_MEDICO" });
    const j = await prisma.justificativa.create({ data: { ...d, empregadoId: u.empregadoId, arquivoId: arquivo?.id } });
    await avisarPatroes(u.clienteId!, { chave: `justificativa:${j.id}`, titulo: `${u.nome.split(" ")[0]} enviou uma justificativa`, texto: `Dia ${formatarData(d.data)}${d.dataFim ? ` a ${formatarData(d.dataFim)}` : ""}: ${d.descricao.slice(0, 120)}. Aceite ou recuse no ponto.`, link: "/cliente/ponto" });
    await registrarAtividade({ usuarioId: u.id, clienteId: u.clienteId, acao: "JUSTIFICATIVA", descricao: `${u.nome} enviou justificativa (${d.tipo.toLowerCase()}) para ${formatarData(d.data)}` });
    revalidatePath("/ponto/justificativas");
    return { ok: true, mensagem: "Justificativa enviada ao empregador." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function pedirAjuste(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirEmpregado();
  try {
    const d = z.object({
      tipo: z.enum(["INCLUSAO", "DESCONSIDERAR"]),
      data: dataCampo("a data"),
      hora: z.string().optional(),
      tipoMarcacao: z.enum(["ENTRADA", "SAIDA_INTERVALO", "RETORNO_INTERVALO", "SAIDA"]).optional(),
      marcacaoId: z.string().optional(),
      justificativa: texto("o motivo"),
    }).parse(dadosDoForm(fd));
    if (d.tipo === "INCLUSAO" && !d.hora) return { erro: "Informe o horário esquecido." };
    if (d.tipo === "DESCONSIDERAR" && !d.marcacaoId) return { erro: "Escolha a marcação errada." };
    if (d.marcacaoId) {
      const m = await prisma.marcacaoPonto.findFirst({ where: { id: d.marcacaoId, empregadoId: u.empregadoId } });
      if (!m) return { erro: "Marcação não encontrada." };
    }
    const ajuste = await prisma.ajustePonto.create({
      data: {
        empregadoId: u.empregadoId,
        data: d.data,
        tipo: d.tipo,
        dataHora: d.tipo === "INCLUSAO" ? instanteLocal(d.data, d.hora!) : null,
        tipoMarcacao: d.tipoMarcacao ?? null,
        marcacaoId: d.marcacaoId ?? null,
        justificativa: d.justificativa,
        solicitadoPorId: u.id,
      },
    });
    await registrarAtividade({ usuarioId: u.id, clienteId: u.clienteId, acao: "AJUSTE_PONTO", descricao: `${u.nome} pediu ajuste de ponto em ${formatarData(d.data)}` });
    await avisarPatroes(u.clienteId!, { chave: `ajuste:${ajuste.id}`, titulo: `${u.nome.split(" ")[0]} pediu ajuste no ponto`, texto: `Dia ${formatarData(d.data)}${d.hora ? `, ${d.hora}` : ""}: ${d.justificativa.slice(0, 120)}. Aprove ou recuse no ponto.`, link: "/cliente/ponto" });
    revalidatePath("/ponto/justificativas");
    return { ok: true, mensagem: "Pedido de ajuste enviado. A marcação original continua guardada." };
  } catch (e) {
    return erroParaEstado(e);
  }
}
