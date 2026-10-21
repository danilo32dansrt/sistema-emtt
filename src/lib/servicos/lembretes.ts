import "server-only";
import {
  addDias, competenciaAnterior, DIAS_SEMANA, diaSemana, ehDiaDeTrabalho12x36, ehFeriado, formatarCompetencia, formatarMoeda, hojeBrasil,
  lembretesDae, lembretesPonto, partesLocais, vencimentoDae, type DiaPonto, type Lembrete,
} from "@/lib/calculos";
import { horariosDoEmpregado, jornadaDoEmpregado, num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { notificar } from "@/lib/notificacoes";

/** Instante UTC do início do dia local (Brasília) — o dia local começa às 03:00 UTC. */
const inicioLocal = (d: Date) => new Date(d.getTime() + 3 * 3600_000);

/**
 * Rotina frequente (a cada 10 minutos): lembretes do ponto para a empregada e para o patrão,
 * a partir do horário do contrato e das marcações do dia.
 */
export async function rodarLembretesPonto(agora = new Date()) {
  const hoje = partesLocais(agora).data;
  const ontem = addDias(hoje, -1);
  const empregados = await prisma.empregado.findMany({
    where: { situacao: "ATIVO", admissao: { lte: hoje }, OR: [{ desligamento: null }, { desligamento: { gte: ontem } }] },
    include: {
      usuario: { select: { id: true, ativo: true } },
      cliente: { include: { usuarios: { where: { papel: "CLIENTE", ativo: true }, select: { id: true } } } },
      ferias: { where: { inicioGozo: { lte: hoje } } },
      afastamentos: { where: { inicio: { lte: hoje }, OR: [{ fim: null }, { fim: { gte: ontem } }] } },
      justificativas: { where: { status: { in: ["APROVADO", "PENDENTE"] }, data: { lte: hoje }, OR: [{ dataFim: null, data: { gte: ontem } }, { dataFim: { gte: ontem } }] } },
    },
  });
  let enviados = 0;
  for (const e of empregados) {
    const [marcacoes, inclusoes] = await Promise.all([
      prisma.marcacaoPonto.findMany({ where: { empregadoId: e.id, dataHora: { gte: inicioLocal(ontem), lt: inicioLocal(addDias(hoje, 1)) } }, select: { dataHora: true } }),
      prisma.ajustePonto.findMany({ where: { empregadoId: e.id, tipo: "INCLUSAO", status: { in: ["APROVADO", "PENDENTE"] }, data: { gte: ontem, lte: hoje } }, select: { dataHora: true } }),
    ]);
    const instantes = [...marcacoes.map((m) => m.dataHora), ...inclusoes.map((a) => a.dataHora).filter((d): d is Date => Boolean(d))];
    const jornada = jornadaDoEmpregado(e);
    const horarios = horariosDoEmpregado(e);
    const montar = (d: Date): DiaPonto => {
      const ds = DIAS_SEMANA[diaSemana(d)];
      const previsto = e.regime === "DOZE_X_TRINTA_SEIS" ? (ehDiaDeTrabalho12x36(d, e.referencia12x36 ?? e.admissao) ? 720 : 0) : Math.round((jornada[ds] ?? 0) * 60);
      const deFerias = e.ferias.some((f) => d >= f.inicioGozo && d < addDias(f.inicioGozo, f.dias));
      const afastado = e.afastamentos.some((a) => d >= a.inicio && (!a.fim || d <= a.fim));
      const justificado = e.justificativas.some((j) => d >= j.data && d <= (j.dataFim ?? j.data));
      const fora = d < e.admissao || (e.desligamento !== null && d > e.desligamento);
      return {
        data: d,
        diaDeTrabalho: previsto > 0 && !fora && !deFerias && !afastado && !justificado && (e.regime === "DOZE_X_TRINTA_SEIS" || !ehFeriado(d)),
        previstoMinutos: previsto,
        entradaPrevista: horarios?.[ds]?.entrada,
        saidaPrevista: horarios?.[ds]?.saida,
        marcacoes: instantes.filter((i) => partesLocais(i).data.getTime() === d.getTime()),
      };
    };
    const lista = lembretesPonto({ agora, nome: e.nome, hoje: montar(hoje), ontem: montar(ontem), acordoIntervaloReduzido: e.acordoIntervaloReduzido });
    for (const l of lista) enviados += await entregar(l, e.usuario?.ativo ? e.usuario.id : null, e.cliente.usuarios.map((u) => u.id), e.id);
  }
  return { empregados: empregados.length, enviados };
}

async function entregar(l: Lembrete, empregadoUsuarioId: string | null, patroes: string[], empregadoId: string): Promise<number> {
  const aviso = { chave: `${empregadoId}:${l.chave}`, titulo: l.titulo, texto: l.texto, link: l.link };
  if (l.para === "EMPREGADO") return empregadoUsuarioId && (await notificar(empregadoUsuarioId, aviso)) ? 1 : 0;
  let n = 0;
  for (const id of patroes) if (await notificar(id, aviso)) n++;
  return n;
}

/** Rotina diária: DAE a pagar e pedidos de ajuste/justificativa esperando a resposta do patrão. */
export async function rodarLembretesDiarios(hoje = hojeBrasil()) {
  let enviados = 0;
  const comp = competenciaAnterior(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1);
  const venc = vencimentoDae(comp.ano, comp.mes);
  const competencias = await prisma.competencia.findMany({
    where: { ano: comp.ano, mes: comp.mes, daeEmitido: true },
    include: { empregado: { select: { nome: true, cliente: { include: { usuarios: { where: { papel: "CLIENTE", ativo: true }, select: { id: true } } } } } } },
  });
  for (const c of competencias) {
    const lista = lembretesDae({ hoje, vencimento: venc, pago: c.pagamentoConfirmado || Boolean(c.clienteInformouPagamentoEm), competencia: formatarCompetencia(c.ano, c.mes), valor: c.daeValor ? formatarMoeda(num(c.daeValor)) : undefined });
    for (const l of lista) {
      for (const u of c.empregado.cliente.usuarios) {
        if (await notificar(u.id, { chave: `${c.empregadoId}:${l.chave}`, titulo: `${l.titulo} — ${c.empregado.nome.split(" ")[0]}`, texto: l.texto, link: l.link })) enviados++;
      }
    }
  }
  // Pedidos da empregada esperando o patrão (um aviso por dia, se houver)
  const clientes = await prisma.cliente.findMany({ where: { ativo: true }, select: { id: true, usuarios: { where: { papel: "CLIENTE", ativo: true }, select: { id: true } } } });
  const dia = hoje.toISOString().slice(0, 10);
  for (const c of clientes) {
    const [ajustes, justificativas] = await Promise.all([
      prisma.ajustePonto.count({ where: { status: "PENDENTE", empregado: { clienteId: c.id } } }),
      prisma.justificativa.count({ where: { status: "PENDENTE", empregado: { clienteId: c.id } } }),
    ]);
    const total = ajustes + justificativas;
    if (!total) continue;
    for (const u of c.usuarios) {
      if (await notificar(u.id, { chave: `pedidos-ponto:${dia}`, titulo: `${total} pedido(s) de ponto esperando você`, texto: "Ajustes de horário ou justificativas de falta enviados pela empregada. Responda para fechar o mês sem divergência.", link: "/cliente/ponto" })) enviados++;
    }
  }
  return { enviados };
}
