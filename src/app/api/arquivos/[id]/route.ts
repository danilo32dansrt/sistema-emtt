import { NextResponse } from "next/server";
import { registrarAtividade } from "@/lib/atividade";
import { usuarioAtual } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { podeVerArquivo } from "@/lib/servicos/acesso-documentos";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioAtual();
  if (!u) return new NextResponse("Faça login.", { status: 401 });
  if (!(await podeVerArquivo(u, id))) return new NextResponse("Arquivo não encontrado.", { status: 404 });
  const a = await prisma.arquivo.findUniqueOrThrow({ where: { id } });
  await registrarAtividade({ usuarioId: u.id, clienteId: a.clienteId, acao: "ARQUIVO_ACESSADO", descricao: `${u.nome} abriu o arquivo "${a.nome}"` });
  return new NextResponse(new Uint8Array(a.dados), {
    headers: {
      "Content-Type": a.mime,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(a.nome)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
