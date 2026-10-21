import { NextResponse } from "next/server";
import { registrarAtividade } from "@/lib/atividade";
import { usuarioAtual } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { anexarManifesto } from "@/lib/pdf/base";
import { podeVerDocumento } from "@/lib/servicos/acesso-documentos";

/** PDF do documento; se já tiver assinaturas, acrescenta a página com o registro das assinaturas. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioAtual();
  if (!u) return new NextResponse("Faça login.", { status: 401 });
  const doc = await podeVerDocumento(u, id);
  if (!doc) return new NextResponse("Documento não encontrado.", { status: 404 });
  const [arquivo, assinaturas] = await Promise.all([
    prisma.arquivo.findUniqueOrThrow({ where: { id: doc.arquivoId } }),
    prisma.assinatura.findMany({ where: { documentoId: id }, orderBy: { assinadoEm: "asc" } }),
  ]);
  let bytes: Uint8Array = new Uint8Array(arquivo.dados);
  if (assinaturas.length && arquivo.mime === "application/pdf") {
    bytes = await anexarManifesto(bytes, assinaturas.map((a) => ({ nome: a.nome, papel: a.papel === "CLIENTE" ? "Empregador(a)" : a.papel === "EMPREGADO" ? "Empregado(a)" : "Consultoria", data: a.assinadoEm, ip: a.ip, hash: a.hashDocumento })), doc.id);
  }
  await registrarAtividade({ usuarioId: u.id, clienteId: doc.clienteId, acao: "DOCUMENTO_ACESSADO", descricao: `${u.nome} abriu "${doc.titulo}"` });
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": arquivo.mime, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`, "Cache-Control": "private, no-store" },
  });
}
