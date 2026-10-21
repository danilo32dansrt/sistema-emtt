import { NextResponse } from "next/server";
import { z } from "zod";
import { usuarioAtual } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

const Inscricao = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }) });

/** Guarda o celular que aceitou receber notificações (patrão e empregada). */
export async function POST(req: Request) {
  const u = await usuarioAtual();
  if (!u || (u.papel !== "CLIENTE" && u.papel !== "EMPREGADO")) return new NextResponse("Faça login.", { status: 401 });
  const r = Inscricao.safeParse(await req.json().catch(() => null));
  if (!r.success) return new NextResponse("Inscrição inválida.", { status: 400 });
  const { endpoint, keys } = r.data;
  const dados = { usuarioId: u.id, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 300) };
  await prisma.inscricaoPush.upsert({ where: { endpoint }, create: { endpoint, ...dados }, update: dados });
  return NextResponse.json({ ok: true });
}

/** Desliga as notificações deste celular. */
export async function DELETE(req: Request) {
  const u = await usuarioAtual();
  if (!u) return new NextResponse("Faça login.", { status: 401 });
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await prisma.inscricaoPush.deleteMany({ where: { endpoint, usuarioId: u.id } });
  return NextResponse.json({ ok: true });
}
