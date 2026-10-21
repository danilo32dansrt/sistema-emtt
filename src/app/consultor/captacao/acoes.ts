"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { salvarBytes } from "@/lib/arquivos";
import { exigirConsultor } from "@/lib/auth/sessao";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { dadosDoForm, dataOpcional, numero, texto, textoOpcional } from "@/lib/formularios";
import { propostaComercial } from "@/lib/pdf/documentos";
import { configuracao } from "@/lib/tabelas-db";

export async function salvarLead(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  try {
    const d = z.object({
      id: z.string().optional(),
      nome: texto("o nome"),
      telefone: textoOpcional,
      email: textoOpcional,
      cidade: textoOpcional,
      qtdEmpregados: numero("empregados", 1, 20),
      origem: textoOpcional,
      status: z.enum(["NOVO", "CONTATO", "PROPOSTA", "NEGOCIACAO", "GANHO", "PERDIDO"]).default("NOVO"),
      proximoContato: dataOpcional,
      observacoes: textoOpcional,
    }).parse(dadosDoForm(fd));
    const { id, ...dados } = d;
    if (id) await prisma.lead.update({ where: { id }, data: dados });
    else await prisma.lead.create({ data: dados });
    revalidatePath("/consultor/captacao");
    return { ok: true, mensagem: "Interessado salvo." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

/** Calcula a proposta pela tabela de preços e gera o PDF. */
export async function gerarProposta(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: String(fd.get("id")) } });
    const precos = await prisma.tabelaPreco.findMany({ where: { ativo: true } });
    const mensal = precos.filter((p) => p.unidade === "mensal");
    const porEmpregado = precos.filter((p) => p.unidade === "por_empregado");
    const total = (mensal[0] ? num(mensal[0].valor) : 0) + (porEmpregado[0] ? num(porEmpregado[0].valor) * Math.max(0, lead.qtdEmpregados - 1) : 0);
    const itens = precos.map((p) => ({ descricao: p.servico, valor: num(p.valor), unidade: p.unidade }));
    const bytes = await propostaComercial(await configuracao(), lead, itens, total);
    const arquivo = await salvarBytes(bytes, { nome: `Proposta - ${lead.nome}.pdf`, mime: "application/pdf", criadoPorId: u.id });
    await prisma.lead.update({ where: { id: lead.id }, data: { valorProposta: total, propostaEm: new Date(), status: lead.status === "NOVO" || lead.status === "CONTATO" ? "PROPOSTA" : lead.status, observacoes: [lead.observacoes, `Proposta: /api/arquivos/${arquivo.id}`].filter(Boolean).join("\n") } });
    revalidatePath("/consultor/captacao");
    return { ok: true, mensagem: "Proposta gerada.", dados: arquivo.id };
  } catch (e) {
    return erroParaEstado(e);
  }
}
