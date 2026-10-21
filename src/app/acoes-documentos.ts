"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { exigirConsultor, exigirPapel, ipRequisicao, userAgent } from "@/lib/auth/sessao";
import { lerData, lerMoeda } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { podeVerDocumento } from "@/lib/servicos/acesso-documentos";
import { gerarDocumento, TIPOS_DOCUMENTO, type TipoDocumento } from "@/lib/servicos/documentos";

export async function acaoGerarDocumento(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const tipo = z.enum(Object.keys(TIPOS_DOCUMENTO) as [TipoDocumento, ...TipoDocumento[]]).parse(fd.get("tipo"));
    const v = (k: string) => (fd.get(k) ? String(fd.get(k)) : undefined);
    const competencia = v("competencia");
    const [ano, mes] = competencia ? competencia.split("-").map(Number) : [Number(v("ano")) || undefined, undefined];
    const doc = await gerarDocumento(
      {
        tipo,
        clienteId: z.string().min(1, "Escolha o cliente.").parse(v("clienteId")),
        empregadoId: v("empregadoId") || null,
        ano,
        mes,
        feriasId: v("feriasId"),
        parcela: v("parcela") === "2" ? 2 : 1,
        valor: v("valor") ? lerMoeda(v("valor")!) : undefined,
        data: v("data") ? lerData(v("data")!) : undefined,
        quem: v("quem") === "EMPREGADO" ? "EMPREGADO" : "EMPREGADOR",
        modoAviso: (v("modoAviso") as "TRABALHADO" | "INDENIZADO" | "DISPENSADO") ?? "TRABALHADO",
      },
      u.id,
    );
    await registrarAtividade({ usuarioId: u.id, clienteId: doc.clienteId, acao: "DOCUMENTO_GERADO", descricao: `Documento "${doc.titulo}" gerado`, entidade: "Documento", entidadeId: doc.id });
    revalidatePath("/consultor/documentos");
    return { ok: true, mensagem: `"${doc.titulo}" gerado. Ele já aparece para assinatura no portal.`, dados: doc.id };
  } catch (e) {
    return erroParaEstado(e);
  }
}

/** Assinatura eletrônica simples: registra quem, quando, IP, navegador e o hash do PDF. */
export async function assinarDocumento(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirPapel("CLIENTE", "EMPREGADO", "CONSULTOR");
  try {
    const id = z.string().parse(fd.get("documentoId"));
    if (fd.get("concordo") !== "on") return { erro: "Confirme que leu o documento." };
    const doc = await podeVerDocumento(u, id);
    if (!doc) return { erro: "Documento não encontrado." };
    if (u.papel === "EMPREGADO" && !doc.exigeAssinaturaEmpregado) return { erro: "Este documento não precisa da sua assinatura." };
    const ja = await prisma.assinatura.findUnique({ where: { documentoId_usuarioId: { documentoId: id, usuarioId: u.id } } });
    if (ja) return { erro: "Você já assinou este documento." };
    await prisma.assinatura.create({ data: { documentoId: id, usuarioId: u.id, nome: u.nome, papel: u.papel, ip: await ipRequisicao(), userAgent: await userAgent(), hashDocumento: doc.hash } });
    const espelho = await prisma.espelhoPonto.findFirst({ where: { documentoId: id } });
    if (espelho) {
      await prisma.espelhoPonto.update({ where: { id: espelho.id }, data: u.papel === "EMPREGADO" ? { assinadoEmpregadoEm: new Date() } : u.papel === "CLIENTE" ? { assinadoEmpregadorEm: new Date() } : {} });
    }
    await registrarAtividade({ usuarioId: u.id, clienteId: doc.clienteId, acao: "DOCUMENTO_ASSINADO", descricao: `${u.nome} assinou "${doc.titulo}"`, entidade: "Documento", entidadeId: id });
    revalidatePath("/", "layout");
    return { ok: true, mensagem: "Documento assinado eletronicamente." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function excluirDocumento(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  const id = String(fd.get("documentoId"));
  const assinaturas = await prisma.assinatura.count({ where: { documentoId: id } });
  if (assinaturas) return { erro: "Documento já assinado não pode ser excluído." };
  const doc = await prisma.documento.delete({ where: { id } });
  await prisma.espelhoPonto.updateMany({ where: { documentoId: id }, data: { documentoId: null } });
  await registrarAtividade({ usuarioId: u.id, clienteId: doc.clienteId, acao: "DOCUMENTO_EXCLUIDO", descricao: `Documento "${doc.titulo}" excluído` });
  revalidatePath("/consultor/documentos");
  return { ok: true };
}
