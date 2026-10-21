import { NextResponse, type NextRequest } from "next/server";
import { addDias, diasNoMes, data, diferencaDias, formatarData, hojeBrasil } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { enviarEmail } from "@/lib/email";
import { agendaDoBanco } from "@/lib/servicos/agenda";

/**
 * Rotina diária (Vercel Cron, ver vercel.json):
 * - marca procurações vencidas;
 * - gera as mensalidades do mês no dia 1º;
 * - envia por e-mail os lembretes dos próximos 7 dias ao consultor e a cada cliente.
 */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) return new NextResponse("Não autorizado", { status: 401 });
  const hoje = hojeBrasil();
  const relatorio: Record<string, number> = {};

  relatorio.procuracoesVencidas = (await prisma.cliente.updateMany({ where: { procuracaoStatus: "ATIVA", procuracaoValidade: { lt: hoje } }, data: { procuracaoStatus: "VENCIDA" } })).count;

  if (hoje.getUTCDate() === 1) {
    const ano = hoje.getUTCFullYear();
    const mes = hoje.getUTCMonth() + 1;
    let n = 0;
    for (const c of await prisma.cliente.findMany({ where: { ativo: true, anonimizadoEm: null } })) {
      const existe = await prisma.mensalidade.findUnique({ where: { clienteId_ano_mes: { clienteId: c.id, ano, mes } } });
      if (!existe) {
        await prisma.mensalidade.create({ data: { clienteId: c.id, ano, mes, valor: c.mensalidade, vencimento: data(ano, mes, Math.min(c.diaVencimento, diasNoMes(ano, mes))) } });
        n++;
      }
    }
    relatorio.mensalidadesGeradas = n;
  }

  const eventos = (await agendaDoBanco({ de: hoje, ate: addDias(hoje, 7), hoje })).filter((e) => e.tipo !== "ANIVERSARIO_ADMISSAO");
  const lista = (ev: typeof eventos) => `<ul>${ev.map((e) => `<li><strong>${formatarData(e.data)}</strong> — ${e.titulo}<br><small>${e.descricao}</small></li>`).join("")}</ul>`;
  const app = process.env.APP_URL ?? "";
  let enviados = 0;
  if (eventos.length) {
    for (const c of await prisma.usuario.findMany({ where: { papel: "CONSULTOR", ativo: true } })) {
      if (await enviarEmail(c.email, `Agenda da semana: ${eventos.length} compromisso(s)`, `<p>Próximos 7 dias:</p>${lista(eventos)}<p><a href="${app}/consultor/agenda">Abrir a agenda</a></p>`)) enviados++;
    }
    const porCliente = new Map<string, typeof eventos>();
    for (const e of eventos) if (e.clienteId) porCliente.set(e.clienteId, [...(porCliente.get(e.clienteId) ?? []), e]);
    for (const [clienteId, evs] of porCliente) {
      const urgentes = evs.filter((e) => diferencaDias(hoje, e.data) <= 3);
      if (!urgentes.length) continue;
      const u = await prisma.usuario.findFirst({ where: { clienteId, papel: "CLIENTE", ativo: true } });
      if (u && (await enviarEmail(u.email, "Lembrete: prazos do seu empregado doméstico", `<p>Olá, ${u.nome.split(" ")[0]}!</p>${lista(urgentes)}<p><a href="${app}/cliente">Abrir o portal</a></p>`))) enviados++;
    }
  }
  relatorio.emailsEnviados = enviados;
  relatorio.eventosSemana = eventos.length;
  return NextResponse.json({ ok: true, data: formatarData(hoje), ...relatorio });
}
