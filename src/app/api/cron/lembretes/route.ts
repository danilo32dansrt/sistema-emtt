import { NextResponse, type NextRequest } from "next/server";
import { rodarLembretesPonto } from "@/lib/servicos/lembretes";

/**
 * Lembretes do ponto (bater a entrada, intervalo, saída, dia esquecido). Precisa rodar a cada 10 minutos:
 * no plano gratuito da Vercel o Cron só roda 1 vez por dia, então use um agendador externo gratuito
 * (ex.: cron-job.org) chamando GET /api/cron/lembretes com o cabeçalho "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) return new NextResponse("Não autorizado", { status: 401 });
  const r = await rodarLembretesPonto();
  return NextResponse.json({ ok: true, ...r });
}
