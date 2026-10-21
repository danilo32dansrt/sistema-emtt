import "server-only";
import type { UsuarioLogado } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

/** Regras de quem pode ver cada documento/arquivo (cada cliente só vê o que é seu). */
export async function podeVerDocumento(u: UsuarioLogado, documentoId: string) {
  const d = await prisma.documento.findUnique({ where: { id: documentoId } });
  if (!d) return null;
  if (u.papel === "CONSULTOR") return d;
  if (u.papel === "CLIENTE" && d.clienteId === u.clienteId && d.visivelCliente) return d;
  if (u.papel === "EMPREGADO" && d.empregadoId === u.empregadoId && d.visivelEmpregado) return d;
  return null;
}

export async function podeVerArquivo(u: UsuarioLogado, arquivoId: string) {
  const a = await prisma.arquivo.findUnique({ where: { id: arquivoId }, select: { id: true, clienteId: true, criadoPorId: true } });
  if (!a) return false;
  if (u.papel === "CONSULTOR") return true;
  if (u.papel === "CLIENTE") return a.clienteId === u.clienteId;
  // Empregado: arquivos que ele mesmo enviou ou de documentos visíveis para ele
  if (a.criadoPorId === u.id) return true;
  const doc = await prisma.documento.findFirst({ where: { arquivoId, empregadoId: u.empregadoId!, visivelEmpregado: true } });
  return Boolean(doc);
}
