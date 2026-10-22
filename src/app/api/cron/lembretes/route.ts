import { NextResponse, type NextRequest } from "next/server";
import { repetirEmergenciasSemResposta } from "@/lib/servicos/emergencia";
import { rodarLembretesConsultor, rodarLembretesPonto } from "@/lib/servicos/lembretes";

/**
 * Lembretes do ponto (bater a entrada, intervalo, saída, dia esquecido) e do consultor (guias, DAE, pedidos). Precisa rodar a cada 10 minutos:
 * no plano gratuito da Vercel o Cron só roda 1 vez por dia, então use um agendador externo gratuito
 * (ex.: cron-job.org) chamando GET /api/cron/lembretes com o cabeçalho "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) return new NextResponse("Não autorizado", { status: 401 });
  // Para testar: ?agora=2026-11-03T11:35:00Z simula o horário (ex.: 08:35 em Brasília, entrada esquecida)
  const simulado = req.nextUrl.searchParams.get("agora");
  const agora = simulado && !Number.isNaN(Date.parse(simulado)) ? new Date(simulado) : new Date();
  const sos = await repetirEmergenciasSemResposta(agora);
  const r = await rodarLembretesPonto(agora);
  const consultor = await rodarLembretesConsultor(agora);
  return NextResponse.json({ ok: true, ...r, consultor, sos });
}
