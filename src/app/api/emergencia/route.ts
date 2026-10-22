import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { usuarioAtual } from "@/lib/auth/sessao";
import { iniciarEmergencia } from "@/lib/servicos/emergencia";

const esquema = z.object({
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  precisao: z.number().min(0).nullable().optional(),
});

/** SOS: a empregada segurou o botão por 2 segundos. Abre a emergência e avisa patrões e consultor na hora. */
export async function POST(req: NextRequest) {
  const origem = req.headers.get("origin");
  if (origem && new URL(origem).host !== req.headers.get("host")) return NextResponse.json({ erro: "Origem não permitida." }, { status: 403 });
  const u = await usuarioAtual();
  if (!u || u.papel !== "EMPREGADO" || !u.empregadoId) return NextResponse.json({ erro: "Faça login novamente." }, { status: 401 });
  const corpo = esquema.safeParse(await req.json().catch(() => ({})));
  const em = await iniciarEmergencia({ empregadoId: u.empregadoId, usuarioId: u.id, ...(corpo.success ? corpo.data : {}) });
  return NextResponse.json({ ok: true, id: em.id });
}
