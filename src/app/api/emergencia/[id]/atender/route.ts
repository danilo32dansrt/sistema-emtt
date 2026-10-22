import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { atenderEmergencia } from "@/lib/servicos/emergencia";

/** "Estou indo" tocado direto na notificação (celular bloqueado): responde ao SOS e para o alarme. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origem = req.headers.get("origin");
  if (origem && new URL(origem).host !== req.headers.get("host")) return NextResponse.json({ erro: "Origem não permitida." }, { status: 403 });
  const u = await usuarioAtual();
  const { id } = await params;
  const em = await prisma.emergencia.findUnique({ where: { id } });
  if (!u || !em || !(u.papel === "CONSULTOR" || (u.papel === "CLIENTE" && u.clienteId === em.clienteId))) return NextResponse.json({ erro: "Não encontrada." }, { status: 404 });
  if (em.status === "ATIVA") await atenderEmergencia(id, u);
  return NextResponse.json({ ok: true });
}
