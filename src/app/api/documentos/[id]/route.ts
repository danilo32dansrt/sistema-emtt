import { NextResponse } from "next/server";
import { registrarAtividade } from "@/lib/atividade";
import { usuarioAtual } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { montarPdfAssinado } from "@/lib/pdf/carimbo";
import { podeVerDocumento } from "@/lib/servicos/acesso-documentos";

/**
 * PDF do documento; se já tiver assinaturas, desenha o carimbo de cada uma no lugar escolhido e acrescenta a página
 * com o registro das assinaturas. Com ?original=1 entrega o arquivo sem carimbos (usado na tela de posicionar).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioAtual();
  if (!u) return new NextResponse("Faça login.", { status: 401 });
  const doc = await podeVerDocumento(u, id);
  if (!doc) return new NextResponse("Documento não encontrado.", { status: 404 });
  const original = new URL(req.url).searchParams.get("original") === "1";
  const [arquivo, assinaturas, posicoes] = await Promise.all([
    prisma.arquivo.findUniqueOrThrow({ where: { id: doc.arquivoId } }),
    prisma.assinatura.findMany({ where: { documentoId: id }, orderBy: { assinadoEm: "asc" } }),
    prisma.posicaoCarimbo.findMany({ where: { documentoId: id } }),
  ]);
  let bytes: Uint8Array = new Uint8Array(arquivo.dados);
  if (!original && assinaturas.length && arquivo.mime === "application/pdf") {
    bytes = await montarPdfAssinado(
      bytes,
      assinaturas.map((a) => ({ usuarioId: a.usuarioId, nome: a.nome, papel: a.papel, data: a.assinadoEm, ip: a.ip, hash: a.hashDocumento })),
      Object.fromEntries(posicoes.map((p) => [p.usuarioId, { pagina: p.pagina, x: p.x, y: p.y }])),
      { codigo: doc.id, endereco: process.env.APP_URL },
    );
  }
  if (!original) await registrarAtividade({ usuarioId: u.id, clienteId: doc.clienteId, acao: "DOCUMENTO_ACESSADO", descricao: `${u.nome} abriu "${doc.titulo}"` });
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": arquivo.mime, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`, "Cache-Control": "private, no-store" },
  });
}
