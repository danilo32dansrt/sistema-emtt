import { NextResponse, type NextRequest } from "next/server";
import { salvarBytes, TAMANHO_MAXIMO } from "@/lib/arquivos";
import { usuarioAtual } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

/** Recebe um trecho de áudio (~15 s) gravado durante o SOS. Só a própria empregada, só enquanto a emergência está aberta. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioAtual();
  if (!u || u.papel !== "EMPREGADO" || !u.empregadoId) return NextResponse.json({ erro: "Faça login novamente." }, { status: 401 });
  const { id } = await params;
  const em = await prisma.emergencia.findUnique({ where: { id } });
  if (!em || em.empregadoId !== u.empregadoId) return NextResponse.json({ erro: "Emergência não encontrada." }, { status: 404 });
  if (em.status === "ENCERRADA" || Date.now() - em.iniciadaEm.getTime() > 30 * 60_000) return NextResponse.json({ erro: "Gravação encerrada.", parar: true }, { status: 409 });
  const mime = (req.headers.get("content-type") ?? "audio/webm").split(";")[0];
  if (!mime.startsWith("audio/")) return NextResponse.json({ erro: "Formato inválido." }, { status: 400 });
  const dados = Buffer.from(await req.arrayBuffer());
  if (!dados.length || dados.length > TAMANHO_MAXIMO) return NextResponse.json({ erro: "Trecho inválido." }, { status: 400 });
  const ordem = await prisma.emergenciaTrecho.count({ where: { emergenciaId: id } });
  const arq = await salvarBytes(dados, { nome: `sos-${id}-${ordem + 1}.${mime.includes("mp4") ? "m4a" : "webm"}`, mime, clienteId: em.clienteId, criadoPorId: u.id });
  await prisma.emergenciaTrecho.create({ data: { emergenciaId: id, arquivoId: arq.id, ordem: ordem + 1 } });
  return NextResponse.json({ ok: true, ordem: ordem + 1, status: em.status, atendidaPor: em.atendidaPor });
}

/** Situação da emergência (o celular dela consulta para mostrar "Fulano está indo"). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioAtual();
  const { id } = await params;
  const em = await prisma.emergencia.findUnique({ where: { id } });
  if (!u || !em || em.empregadoId !== u.empregadoId) return NextResponse.json({ erro: "Não encontrada." }, { status: 404 });
  return NextResponse.json({ status: em.status, atendidaPor: em.atendidaPor });
}
