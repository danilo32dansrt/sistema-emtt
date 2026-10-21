import "server-only";
import type { Afastamento, Empregado, Ferias, Justificativa } from "@prisma/client";
import {
  addDias, competenciaAnterior, DIAS_SEMANA, diaSemana, diferencaDias, ehDiaDeTrabalho12x36, ehFeriado, formatarCompetencia, formatarData, formatarMoeda,
  hojeBrasil, lembretesConsultor, lembretesDae, lembretesPedidosPendentes, lembretesPonto, situacaoChecklist, ultimoDiaMes, partesLocais, vencimentoDae, type DiaPonto, type Lembrete,
} from "@/lib/calculos";
import { horariosDoEmpregado, jornadaDoEmpregado, num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { notificar } from "@/lib/notificacoes";
import { configuracao } from "@/lib/tabelas-db";
import { situacaoParametros } from "./parametros";

/** Quantos dias para trás uma pendência do ponto continua sendo lembrada. */
const DIAS_PENDENCIA = 3;

/** Instante UTC do início do dia local (Brasília) — o dia local começa às 03:00 UTC. */
const inicioLocal = (d: Date) => new Date(d.getTime() + 3 * 3600_000);

type EmpregadoCompleto = Empregado & { ferias: Ferias[]; afastamentos: Afastamento[]; justificativas: Justificativa[] };

const incluirDias = (de: Date, hoje: Date) => ({
  ferias: { where: { inicioGozo: { lte: hoje } } },
  afastamentos: { where: { inicio: { lte: hoje }, OR: [{ fim: null }, { fim: { gte: de } }] } },
  justificativas: { where: { status: { in: ["APROVADO" as const, "PENDENTE" as const] }, data: { lte: hoje }, OR: [{ dataFim: null, data: { gte: de } }, { dataFim: { gte: de } }] } },
});

/** Monta os dias (hoje e os anteriores) com o previsto do contrato e as marcações, para as regras de lembrete. */
async function diasDoEmpregado(e: EmpregadoCompleto, hoje: Date) {
  const de = addDias(hoje, -DIAS_PENDENCIA);
  const [marcacoes, inclusoes] = await Promise.all([
    prisma.marcacaoPonto.findMany({ where: { empregadoId: e.id, dataHora: { gte: inicioLocal(de), lt: inicioLocal(addDias(hoje, 1)) } }, select: { dataHora: true } }),
    // Pedidos de inclusão (mesmo pendentes) já resolvem a pendência da empregada; a decisão vira pendência do patrão
    prisma.ajustePonto.findMany({ where: { empregadoId: e.id, tipo: "INCLUSAO", status: { in: ["APROVADO", "PENDENTE"] }, data: { gte: de, lte: hoje } }, select: { dataHora: true } }),
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
      diaDeTrabalho: e.pontoAtivo && previsto > 0 && !fora && !deFerias && !afastado && !justificado && (e.regime === "DOZE_X_TRINTA_SEIS" || !ehFeriado(d)),
      previstoMinutos: previsto,
      entradaPrevista: horarios?.[ds]?.entrada,
      saidaPrevista: horarios?.[ds]?.saida,
      marcacoes: instantes.filter((i) => partesLocais(i).data.getTime() === d.getTime()),
    };
  };
  return { hoje: montar(hoje), anteriores: Array.from({ length: DIAS_PENDENCIA }, (_, i) => montar(addDias(hoje, -(i + 1)))) };
}

/** Pendências do ponto deste momento (para lembretes e para os botões na tela). */
async function lembretesDoEmpregado(e: EmpregadoCompleto, agora: Date, paraTela = false): Promise<Lembrete[]> {
  const dias = await diasDoEmpregado(e, partesLocais(agora).data);
  return lembretesPonto({ agora, nome: e.nome, ...dias, acordoIntervaloReduzido: e.acordoIntervaloReduzido, horarioComercial: paraTela ? { inicio: 0, fim: 24 * 60 } : undefined });
}

/** Uma pendência por tipo (sem a parte da chave que controla a repetição) — para mostrar na tela. */
function paraTela(lista: Lembrete[], para: Lembrete["para"]) {
  const vistos = new Set<string>();
  return lista.filter((l) => l.para === para).filter((l) => {
    const k = l.chave.split(":").slice(0, 2).join(":");
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

const buscarEmpregados = (where: object, hoje: Date) =>
  prisma.empregado.findMany({
    where: { situacao: "ATIVO", admissao: { lte: hoje }, ...where },
    include: { ...incluirDias(addDias(hoje, -DIAS_PENDENCIA), hoje), usuario: { select: { id: true, ativo: true } }, cliente: { include: { usuarios: { where: { papel: "CLIENTE", ativo: true }, select: { id: true } } } } },
  });

/** Botões de pendência na tela da empregada. */
export async function pendenciasDaEmpregada(empregadoId: string, agora = new Date()) {
  const hoje = partesLocais(agora).data;
  const [e] = await buscarEmpregados({ id: empregadoId }, hoje);
  return e ? paraTela(await lembretesDoEmpregado(e, agora, true), "EMPREGADO") : [];
}

export interface PendenciaPatrao extends Lembrete {
  urgente?: boolean;
}

/** Botões de pendência na tela do patrão: ponto dos empregados, pedidos esperando resposta e DAE. */
export async function pendenciasDoPatrao(clienteId: string, agora = new Date()): Promise<PendenciaPatrao[]> {
  const hoje = partesLocais(agora).data;
  const lista: PendenciaPatrao[] = [];
  const empregados = await buscarEmpregados({ clienteId }, hoje);
  // DAE da competência anterior (vence dia 7): botão a partir de 5 dias antes até ser pago
  const comp = competenciaAnterior(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1);
  const venc = vencimentoDae(comp.ano, comp.mes);
  const dias = diferencaDias(hoje, venc);
  const competencias = await prisma.competencia.findMany({ where: { ano: comp.ano, mes: comp.mes, daeEmitido: true, pagamentoConfirmado: false, clienteInformouPagamentoEm: null, empregado: { clienteId } }, include: { empregado: { select: { nome: true } } } });
  for (const c of competencias) {
    if (dias > 5) continue;
    const valor = c.daeValor ? ` de ${formatarMoeda(num(c.daeValor))}` : "";
    lista.push({
      chave: `dae:${c.id}`, para: "EMPREGADOR", link: "/cliente/dae", acao: "Pagar o DAE agora", urgente: dias <= 0,
      titulo: dias < 0 ? `DAE em atraso — ${c.empregado.nome.split(" ")[0]}` : dias === 0 ? `Hoje é dia de pagar o DAE — ${c.empregado.nome.split(" ")[0]}` : `DAE vence em ${dias} dia(s) — ${c.empregado.nome.split(" ")[0]}`,
      texto: `Competência ${formatarCompetencia(c.ano, c.mes)}${valor}, vencimento ${formatarData(venc)}. Depois de pagar, toque em "Já paguei".`,
    });
  }
  const pendentes = await contarPedidos(clienteId);
  if (pendentes) lista.push(...lembretesPedidosPendentes({ agora, pendentes, horarioComercial: { inicio: 0, fim: 24 * 60 } }).map((l) => ({ ...l, urgente: true })));
  for (const e of empregados) lista.push(...paraTela(await lembretesDoEmpregado(e, agora, true), "EMPREGADOR"));
  return lista;
}

const contarPedidos = async (clienteId: string) =>
  (await prisma.ajustePonto.count({ where: { status: "PENDENTE", empregado: { clienteId } } })) + (await prisma.justificativa.count({ where: { status: "PENDENTE", empregado: { clienteId } } }));

/**
 * Rotina frequente (a cada 10 minutos): manda os lembretes do ponto e dos pedidos pendentes.
 * Cada pendência volta a ser lembrada a cada hora até ser resolvida.
 */
export async function rodarLembretesPonto(agora = new Date()) {
  const hoje = partesLocais(agora).data;
  const empregados = await buscarEmpregados({ OR: [{ desligamento: null }, { desligamento: { gte: addDias(hoje, -DIAS_PENDENCIA) } }] }, hoje);
  let enviados = 0;
  for (const e of empregados) {
    for (const l of await lembretesDoEmpregado(e, agora)) {
      const aviso = { chave: `${e.id}:${l.chave}`, titulo: l.titulo, texto: l.texto, link: l.link, acao: l.acao };
      if (l.para === "EMPREGADO") {
        if (e.usuario?.ativo && (await notificar(e.usuario.id, aviso))) enviados++;
      } else for (const u of e.cliente.usuarios) if (await notificar(u.id, aviso)) enviados++;
    }
  }
  const clientes = await prisma.cliente.findMany({ where: { ativo: true }, select: { id: true, usuarios: { where: { papel: "CLIENTE", ativo: true }, select: { id: true } } } });
  for (const c of clientes) {
    const pendentes = await contarPedidos(c.id);
    for (const l of lembretesPedidosPendentes({ agora, pendentes })) for (const u of c.usuarios) if (await notificar(u.id, { ...l })) enviados++;
  }
  return { empregados: empregados.length, enviados };
}

/** Rotina diária: lembretes do DAE (3 dias antes, no dia e em atraso). */
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
        if (await notificar(u.id, { chave: `${c.empregadoId}:${l.chave}`, titulo: `${l.titulo} — ${c.empregado.nome.split(" ")[0]}`, texto: l.texto, link: l.link, acao: l.acao })) enviados++;
      }
    }
  }
  return { enviados };
}

/** Situação geral da carteira para os lembretes do consultor (DAE, rotina, pedidos, mensagens, prazos). */
export async function situacaoDoConsultor(agora = new Date()) {
  const hoje = partesLocais(agora).data;
  const comp = competenciaAnterior(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1);
  const fimComp = ultimoDiaMes(comp.ano, comp.mes);
  const [cfg, empregados, pedidos, mensagens, justaCausa, procuracoes, mensalidades, parametros] = await Promise.all([
    configuracao(),
    prisma.empregado.findMany({ where: { situacao: { not: "DESLIGADO" }, admissao: { lte: fimComp }, cliente: { ativo: true } }, include: { competencias: { where: { ano: comp.ano, mes: comp.mes } } } }),
    prisma.ajustePonto.count({ where: { status: "PENDENTE" } }).then(async (n) => n + (await prisma.justificativa.count({ where: { status: "PENDENTE" } }))),
    prisma.mensagem.count({ where: { lidaEm: null, autor: { papel: "CLIENTE" } } }),
    prisma.ocorrenciaDisciplinar.count({ where: { status: "EM_ANALISE_CONSULTOR" } }),
    prisma.cliente.count({ where: { ativo: true, OR: [{ procuracaoStatus: "VENCIDA" }, { procuracaoStatus: "ATIVA", procuracaoValidade: { lte: addDias(hoje, 30) } }] } }),
    prisma.mensalidade.count({ where: { status: "ABERTO", vencimento: { lt: hoje } } }),
    situacaoParametros(hoje).then((l) => l.filter((p) => p.pendente || p.fonteMudou || !p.vigente).length),
  ]);
  const c = (e: (typeof empregados)[number]) => e.competencias[0];
  return {
    agora,
    diaEmissaoGuias: cfg.diaEmissaoGuias,
    vencimentoDae: vencimentoDae(comp.ano, comp.mes),
    competencia: formatarCompetencia(comp.ano, comp.mes),
    daesParaEmitir: empregados.filter((e) => !c(e)?.daeEmitido).length,
    pagamentosAConfirmar: empregados.filter((e) => c(e)?.daeEmitido && !c(e)?.pagamentoConfirmado).length,
    rotinaAtrasada: empregados.reduce((t, e) => t + situacaoChecklist(comp.ano, comp.mes, c(e) ?? {}, hoje).atrasadas.length, 0),
    pedidosPonto: pedidos,
    mensagensNaoLidas: mensagens,
    justaCausaParaRevisar: justaCausa,
    procuracoesVencendo: procuracoes,
    mensalidadesAtrasadas: mensalidades,
    parametrosParaConferir: parametros,
  };
}

/** Lembretes do consultor no celular: resumo do dia e urgências repetidas a cada hora enquanto pendentes. */
export async function rodarLembretesConsultor(agora = new Date()) {
  const lista = lembretesConsultor(await situacaoDoConsultor(agora));
  if (!lista.length) return 0;
  const consultores = await prisma.usuario.findMany({ where: { papel: "CONSULTOR", ativo: true }, select: { id: true } });
  let n = 0;
  for (const l of lista) for (const u of consultores) if (await notificar(u.id, { chave: l.chave, titulo: l.titulo, texto: l.texto, link: l.link, acao: l.acao })) n++;
  return n;
}
