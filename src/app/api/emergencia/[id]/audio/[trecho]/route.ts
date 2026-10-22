import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

/** Áudio de um trecho do SOS: patrões do cliente e consultor (fica registrado no log de atividades ao abrir a página). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; trecho: string }> }) {
  const u = await usuarioAtual();
  const { id, trecho } = await params;
  const t = await prisma.emergenciaTrecho.findFirst({ where: { id: trecho, emergenciaId: id }, include: { emergencia: { select: { clienteId: true } } } });
  if (!u || !t || !(u.papel === "CONSULTOR" || (u.papel === "CLIENTE" && u.clienteId === t.emergencia.clienteId))) return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });
  const a = await prisma.arquivo.findUniqueOrThrow({ where: { id: t.arquivoId } });
  return new NextResponse(new Uint8Array(a.dados), { headers: { "content-type": a.mime, "cache-control": "private, no-store" } });
}
