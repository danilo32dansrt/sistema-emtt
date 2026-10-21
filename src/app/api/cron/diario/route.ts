import { NextResponse, type NextRequest } from "next/server";
import { addDias, diasNoMes, data, diferencaDias, formatarData, hojeBrasil } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { enviarEmail } from "@/lib/email";
import { agendaDoBanco } from "@/lib/servicos/agenda";
import { rotinaCobrancaInter } from "@/lib/servicos/cobranca-inter";
import { situacaoParametros, verificarFontesOficiais } from "@/lib/servicos/parametros";

/**
 * Rotina diária (Vercel Cron, ver vercel.json):
 * - marca procurações vencidas;
 * - gera as mensalidades do mês no dia 1º;
 * - envia por e-mail os lembretes dos próximos 7 dias ao consultor e a cada cliente;
 * - emite pelo Banco Inter as cobranças das mensalidades e confere as pendentes (baixa automática);
 * - lembra o cliente da mensalidade que vai vencer;
 * - verifica as páginas oficiais dos parâmetros e avisa o consultor quando há algo a conferir.
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

  // Cobrança automática pelo Inter (só se ligada nas configurações e com credenciais no .env)
  try {
    const inter = await rotinaCobrancaInter(hoje);
    relatorio.cobrancasInterEmitidas = inter.emitidas;
    relatorio.cobrancasInterConferidas = inter.conferidas;
    relatorio.mensalidadesPagasInter = inter.pagas;
    relatorio.errosInter = inter.erros;
  } catch (e) {
    console.error("Rotina de cobrança Inter falhou", e);
    relatorio.errosInter = -1;
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
  // Lembrete automático de mensalidade (3 dias antes e no dia do vencimento), uma vez por mensalidade e etapa
  const abertas = await prisma.mensalidade.findMany({ where: { status: "ABERTO", vencimento: { gte: hoje, lte: addDias(hoje, 3) } }, include: { cliente: { include: { usuarios: { where: { papel: "CLIENTE", ativo: true } } } } } });
  let lembretes = 0;
  for (const m of abertas) {
    if (m.lembreteEnviadoEm && diferencaDias(m.lembreteEnviadoEm, hoje) < 3) continue;
    const u = m.cliente.usuarios[0];
    if (!u) continue;
    if (await enviarEmail(u.email, "Lembrete: mensalidade da consultoria", `<p>Olá, ${u.nome.split(" ")[0]}!</p><p>A mensalidade de ${String(m.mes).padStart(2, "0")}/${m.ano}, no valor de R$ ${Number(m.valor).toFixed(2).replace(".", ",")}, vence em ${formatarData(m.vencimento)}.</p><p><a href="${app}/cliente/mensalidade">Pagar com Pix ou boleto</a></p>`)) {
      await prisma.mensalidade.update({ where: { id: m.id }, data: { lembreteEnviadoEm: new Date() } });
      lembretes++;
    }
  }
  relatorio.lembretesMensalidade = lembretes;

  // Parâmetros legais: verificação das páginas oficiais (segundas-feiras) e alerta de conferência
  // todo 2 de janeiro e, semanalmente, enquanto houver parâmetro com mais de 6 meses sem conferência.
  if (hoje.getUTCDay() === 1) {
    const v = await verificarFontesOficiais();
    relatorio.fontesVerificadas = v.verificadas;
    relatorio.fontesMudaram = v.mudaram;
  }
  const pendentes = (await situacaoParametros(hoje)).filter((p) => p.pendente || p.fonteMudou || !p.vigente);
  const doisDeJaneiro = hoje.getUTCMonth() === 0 && hoje.getUTCDate() === 2;
  if (doisDeJaneiro || (pendentes.length && hoje.getUTCDay() === 1)) {
    for (const c of await prisma.usuario.findMany({ where: { papel: "CONSULTOR", ativo: true } })) {
      await enviarEmail(c.email, doisDeJaneiro ? "Início do ano: confira os parâmetros legais" : `${pendentes.length} parâmetro(s) legal(is) para conferir`, `<p>${doisDeJaneiro ? "Novo ano: confira salário mínimo, INSS, salário-família, Bolsa Família e BPC antes de fechar a folha de janeiro." : "Os parâmetros abaixo precisam ser conferidos na fonte oficial:"}</p><ul>${pendentes.map((p) => `<li>${p.def.rotulo}${p.fonteMudou ? " (a página oficial mudou)" : ""}</li>`).join("")}</ul><p><a href="${app}/consultor/parametros">Abrir os parâmetros legais</a></p>`);
    }
  }
  relatorio.parametrosParaConferir = pendentes.length;
  relatorio.emailsEnviados = enviados;
  relatorio.eventosSemana = eventos.length;
  return NextResponse.json({ ok: true, data: formatarData(hoje), ...relatorio });
}
