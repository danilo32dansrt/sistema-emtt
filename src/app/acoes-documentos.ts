"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { exigirConsultor, exigirPapel, ipRequisicao, userAgent } from "@/lib/auth/sessao";
import { lerData, lerMoeda } from "@/lib/calculos";
import { limitarPosicao } from "@/lib/assinatura/carimbo";
import { prisma } from "@/lib/db";
import { infoPdf } from "@/lib/pdf/carimbo";
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

/**
 * Guarda o lugar do carimbo de assinatura (arrastado na tela). Só visual: o PDF original e o hash não mudam.
 * Cada signatário move o seu; o consultor pode mover o de qualquer signatário. Sem posição ("padrao"), volta
 * para cima da linha de assinatura.
 */
export async function salvarPosicaoCarimbo(entrada: { documentoId: string; usuarioId?: string; pagina?: number; x?: number; y?: number; padrao?: boolean }): Promise<EstadoAcao> {
  const u = await exigirPapel("CLIENTE", "EMPREGADO", "CONSULTOR");
  try {
    const e = z.object({ documentoId: z.string().min(1), usuarioId: z.string().optional(), pagina: z.number().int().min(0).optional(), x: z.number().min(0).max(1).optional(), y: z.number().min(0).max(1).optional(), padrao: z.boolean().optional() }).parse(entrada);
    const doc = await podeVerDocumento(u, e.documentoId);
    if (!doc) return { erro: "Documento não encontrado." };
    const alvo = e.usuarioId ?? u.id;
    if (alvo !== u.id && u.papel !== "CONSULTOR") return { erro: "Você só pode mover a sua própria assinatura." };
    const assinou = await prisma.assinatura.findUnique({ where: { documentoId_usuarioId: { documentoId: doc.id, usuarioId: alvo } } });
    const vaiAssinar = alvo === u.id && ((u.papel === "EMPREGADO" && doc.exigeAssinaturaEmpregado) || (u.papel === "CLIENTE" && doc.exigeAssinaturaCliente));
    if (!assinou && !vaiAssinar) return { erro: "Esta pessoa não assina este documento." };
    const chave = { documentoId_usuarioId: { documentoId: doc.id, usuarioId: alvo } };
    if (e.padrao) {
      await prisma.posicaoCarimbo.deleteMany({ where: { documentoId: doc.id, usuarioId: alvo } });
      return { ok: true, mensagem: "A assinatura voltou para o lugar padrão." };
    }
    if (e.pagina === undefined || e.x === undefined || e.y === undefined) return { erro: "Posição inválida." };
    const arquivo = await prisma.arquivo.findUniqueOrThrow({ where: { id: doc.arquivoId } });
    const { paginas } = await infoPdf(new Uint8Array(arquivo.dados));
    const p = limitarPosicao({ pagina: e.pagina, x: e.x, y: e.y }, paginas);
    await prisma.posicaoCarimbo.upsert({ where: chave, create: { documentoId: doc.id, usuarioId: alvo, ...p }, update: p });
    await registrarAtividade({ usuarioId: u.id, clienteId: doc.clienteId, acao: "CARIMBO_POSICIONADO", descricao: `${u.nome} posicionou a assinatura em "${doc.titulo}" (página ${p.pagina + 1})`, entidade: "Documento", entidadeId: doc.id });
    return { ok: true, mensagem: "Lugar da assinatura salvo." };
  } catch (err) {
    return erroParaEstado(err);
  }
}
