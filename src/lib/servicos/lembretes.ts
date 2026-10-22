import "server-only";
import type { Afastamento, Empregado, EscalaDia, Ferias, Justificativa, TratamentoDia } from "@prisma/client";
import {
  addDias, agruparJornadas, competenciaAnterior, DIAS_SEMANA, diaSemana, diferencaDias, ehDiaDeTrabalho12x36, ehFeriado, formatarCompetencia, formatarData, formatarMoeda,
  entradasPossiveis, hojeBrasil, lembretesCobrancaPlus, lembretesEscala, parametrosJornada, saidaDaEscala, lembretesConsultor, lembretesDae, lembretesFechamento, lembretesPedidosPendentes, lembretesPonto, marcacaoQueFalta, partesLocais,
  situacaoChecklist, ultimoDiaMes, vencimentoDae, type DiaPonto, type Lembrete,
} from "@/lib/calculos";
import { horariosDoEmpregado, jornadaDoEmpregado, num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { notificar } from "@/lib/notificacoes";
import { configuracao, registrosParametros } from "@/lib/tabelas-db";
import { situacaoParametros } from "./parametros";
import { espelhoDoMes, resumoDoMes } from "./ponto";

/** Quantos dias para trás uma pendência do ponto continua sendo lembrada. */
const DIAS_PENDENCIA = 3;

/** Instante UTC do início do dia local (Brasília) — o dia local começa às 03:00 UTC. */
const inicioLocal = (d: Date) => new Date(d.getTime() + 3 * 3600_000);

type EmpregadoCompleto = Empregado & { ferias: Ferias[]; afastamentos: Afastamento[]; justificativas: Justificativa[]; tratamentosDia: TratamentoDia[]; escalas: EscalaDia[] };

const incluirDias = (de: Date, hoje: Date) => ({
  ferias: { where: { inicioGozo: { lte: hoje } } },
  afastamentos: { where: { inicio: { lte: hoje }, OR: [{ fim: null }, { fim: { gte: de } }] } },
  justificativas: { where: { status: { in: ["APROVADO" as const, "PENDENTE" as const] }, data: { lte: hoje }, OR: [{ dataFim: null, data: { gte: de } }, { dataFim: { gte: de } }] } },
  tratamentosDia: { where: { data: { gte: de, lte: hoje } } },
  escalas: { where: { data: { gte: de, lte: addDias(hoje, 1) } } },
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
  const jornadas = agruparJornadas(instantes);
  const montar = (d: Date): DiaPonto => {
    const ds = DIAS_SEMANA[diaSemana(d)];
    const previsto = e.regime === "DOZE_X_TRINTA_SEIS" ? (ehDiaDeTrabalho12x36(d, e.referencia12x36 ?? e.admissao) ? 720 : 0) : Math.round((jornada[ds] ?? 0) * 60);
    const deFerias = e.ferias.some((f) => d >= f.inicioGozo && d < addDias(f.inicioGozo, f.dias));
    const afastado = e.afastamentos.some((a) => d >= a.inicio && (!a.fim || d <= a.fim));
    // Dia justificado ou já decidido pelo patrão (abonar/compensar/descontar) não é mais pendência
    const justificado = e.justificativas.some((j) => d >= j.data && d <= (j.dataFim ?? j.data)) || e.tratamentosDia.some((t) => t.data.getTime() === d.getTime());
    const fora = d < e.admissao || (e.desligamento !== null && d > e.desligamento);
    return {
      data: d,
      diaDeTrabalho: e.pontoAtivo && previsto > 0 && !fora && !deFerias && !afastado && !justificado && (e.regime === "DOZE_X_TRINTA_SEIS" || !ehFeriado(d)),
      previstoMinutos: previsto,
      // Horário flexível: vale a escala escolhida para o dia; senão, o horário do contrato
      entradaPrevista: e.escalas.find((x) => x.data.getTime() === d.getTime())?.entrada ?? horarios?.[ds]?.entrada,
      saidaPrevista: e.escalas.find((x) => x.data.getTime() === d.getTime())?.saida ?? horarios?.[ds]?.saida,
      // A jornada pertence ao dia em que começou (turno da noite termina no dia seguinte)
      marcacoes: jornadas.find((j) => j.data.getTime() === d.getTime())?.marcacoes ?? [],
    };
  };
  return { hoje: montar(hoje), amanha: montar(addDias(hoje, 1)), anteriores: Array.from({ length: DIAS_PENDENCIA }, (_, i) => montar(addDias(hoje, -(i + 1)))) };
}

/** Pendências do ponto deste momento (para lembretes e para os botões na tela). */
/** Limites do regime no dia (tabela de parâmetros), para os avisos de hora extra e de jornada máxima. */
async function limitesDoRegime(e: Empregado, data: Date) {
  const L = parametrosJornada(await registrosParametros(), data);
  if (e.regime === "PARCIAL") return { limiteExtraMinutos: L.parcialExtraDiaria * 60, limiteDiaMinutos: L.parcialDiariaMax * 60, regraLimite: `tempo parcial: até ${L.parcialExtraDiaria}h extra e ${L.parcialDiariaMax}h no dia` };
  if (e.regime === "DOZE_X_TRINTA_SEIS") return { limiteExtraMinutos: 0, limiteDiaMinutos: L.doze36Max * 60, regraLimite: `escala 12x36: até ${L.doze36Max}h` };
  return { limiteExtraMinutos: 120, limiteDiaMinutos: L.limiteDiario * 60, regraLimite: `até ${L.limiteDiario}h no dia` };
}

async function lembretesDoEmpregado(e: EmpregadoCompleto, agora: Date, paraTela = false): Promise<Lembrete[]> {
  const { amanha: _amanha, ...dias } = await diasDoEmpregado(e, partesLocais(agora).data);
  void _amanha;
  return lembretesPonto({ agora, nome: e.nome, ...dias, ...(await limitesDoRegime(e, dias.hoje.data)), acordoIntervaloReduzido: e.acordoIntervaloReduzido, horarioComercial: paraTela ? { inicio: 0, fim: 24 * 60 } : undefined });
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

export interface OpcaoPendencia {
  rotulo: string;
  /** Tipo da ação de um toque (ver src/app/acoes-pendencias.ts) ou LINK. */
  tipo: string;
  dados?: Record<string, string>;
  link?: string;
  estilo?: "primario" | "sucesso" | "perigo" | "secundario";
  confirmar?: string;
  /** Campo opcional junto do botão (ex.: adiantamento no fechamento do mês). */
  campo?: { nome: string; rotulo: string };
}

export interface PendenciaComAcoes extends Lembrete {
  urgente?: boolean;
  opcoes?: OpcaoPendencia[];
}
export type PendenciaPatrao = PendenciaComAcoes;

/** Pendências do ponto deste momento já com os botões que resolvem cada uma. */
async function pendenciasPontoNaTela(e: EmpregadoCompleto, agora: Date, para: "EMPREGADO" | "EMPREGADOR"): Promise<PendenciaComAcoes[]> {
  const dias = await diasDoEmpregado(e, partesLocais(agora).data);
  const lista = paraTela(lembretesPonto({ agora, nome: e.nome, hoje: dias.hoje, anteriores: dias.anteriores, ...(await limitesDoRegime(e, dias.hoje.data)), acordoIntervaloReduzido: e.acordoIntervaloReduzido, horarioComercial: { inicio: 0, fim: 24 * 60 } }), para);
  const todos = [dias.hoje, ...dias.anteriores];
  const compensa = e.regime === "INTEGRAL" && e.acordoCompensacao;
  const nome = e.nome.split(" ")[0];
  const itens: PendenciaComAcoes[] = lista.map((l) => {
    const [tipo, diaIso] = l.chave.split(":");
    const dia = todos.find((d) => d.data.toISOString().slice(0, 10) === diaIso);
    const base = { empregadoId: e.id, data: diaIso };
    const horario = dia?.entradaPrevista && dia?.saidaPrevista ? `${dia.entradaPrevista}–${dia.saidaPrevista}` : null;
    const opcoes: OpcaoPendencia[] = [];
    const tratar = (incluirDescontar = true) => {
      if (incluirDescontar) opcoes.push({ rotulo: `${nome} faltou — descontar`, tipo: "TRATAR", dados: { ...base, tratamento: "DESCONTAR" }, estilo: "perigo" });
      opcoes.push({ rotulo: "Abonar (não descontar)", tipo: "TRATAR", dados: { ...base, tratamento: "ABONAR" }, estilo: "secundario" });
      if (compensa) opcoes.push({ rotulo: "Vai compensar no mês", tipo: "TRATAR", dados: { ...base, tratamento: "COMPENSAR" }, estilo: "secundario" });
    };
    if (para === "EMPREGADOR") {
      if (tipo === "dia-sem") {
        if (horario) opcoes.push({ rotulo: `Trabalhou no horário normal (${horario})`, tipo: "LANCAR_CONTRATO", dados: base, estilo: "sucesso" });
        tratar();
      } else if (tipo === "dia-incompleto") {
        const falta = dia ? marcacaoQueFalta(dia.marcacoes.map((m) => partesLocais(m).minutos), dia.saidaPrevista) : null;
        if (falta) opcoes.push({ rotulo: `Saiu às ${falta} (horário normal)`, tipo: "COMPLETAR_SAIDA", dados: { ...base, hora: falta }, estilo: "sucesso" });
        opcoes.push({ rotulo: "Descontar o que faltou", tipo: "TRATAR", dados: { ...base, tratamento: "DESCONTAR" }, estilo: "secundario" });
      } else if (tipo === "sem-entrada") {
        tratar();
      }
    } else {
      if (tipo === "dia-sem") {
        if (horario) opcoes.push({ rotulo: `Trabalhei no meu horário (${horario})`, tipo: "PEDIR_CONTRATO", dados: { data: diaIso }, estilo: "sucesso" });
        opcoes.push({ rotulo: "Faltei — justificar", tipo: "LINK", link: `/ponto/justificativas?data=${diaIso}`, estilo: "secundario" });
      } else if (tipo === "dia-incompleto") {
        const falta = dia ? marcacaoQueFalta(dia.marcacoes.map((m) => partesLocais(m).minutos), dia.saidaPrevista) : null;
        if (falta) opcoes.push({ rotulo: `Saí às ${falta}`, tipo: "PEDIR_SAIDA", dados: { data: diaIso, hora: falta }, estilo: "sucesso" });
        opcoes.push({ rotulo: "Informar outro horário", tipo: "LINK", link: "/ponto/justificativas", estilo: "secundario" });
      }
    }
    return { ...l, chave: `${e.id}:${l.chave}`, opcoes: opcoes.length ? opcoes : undefined };
  });
  // Horário flexível: escolher num toque o horário de amanhã (para o patrão)
  const escolha = para === "EMPREGADOR" ? opcoesEscala(e, dias.amanha) : null;
  return escolha ? [escolha, ...itens] : itens;
}

/** Pergunta "qual horário amanhã?" com um botão por horário possível dentro da faixa do contrato. */
function opcoesEscala(e: EmpregadoCompleto, amanha: DiaPonto): PendenciaComAcoes | null {
  if (!e.horarioFlexivel || !amanha.diaDeTrabalho || !amanha.previstoMinutos) return null;
  if (e.escalas.some((x) => x.data.getTime() === amanha.data.getTime())) return null;
  const data = amanha.data.toISOString().slice(0, 10);
  const horas = entradasPossiveis(e.faixaInicio ?? "07:00", e.faixaFim ?? "19:00", amanha.previstoMinutos, e.acordoIntervaloReduzido);
  const deSempre = amanha.entradaPrevista;
  const lista = deSempre && !horas.includes(deSempre) ? [deSempre, ...horas] : horas;
  if (!lista.length) return null;
  const nome = e.nome.split(" ")[0];
  return {
    chave: `${e.id}:escala:${data}`, para: "EMPREGADOR", link: "/cliente", acao: "Ver o ponto", urgente: false,
    titulo: `Qual horário ${nome} entra amanhã (${formatarData(amanha.data).slice(0, 5)})?`,
    texto: `Jornada de ${(amanha.previstoMinutos / 60).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}h. Escolha a entrada; a saída é calculada sozinha. Sem escolha até as 21h, vale o horário de sempre${deSempre ? ` (${deSempre})` : ""}.`,
    opcoes: lista.map((h) => ({ rotulo: `${h} às ${saidaDaEscala(h, amanha.previstoMinutos, e.acordoIntervaloReduzido)}${h === deSempre ? " (o de sempre)" : ""}`, tipo: "ESCALA", dados: { empregadoId: e.id, data, entrada: h }, estilo: h === deSempre ? ("sucesso" as const) : ("secundario" as const) })),
  };
}

/** Botões de pendência na tela da empregada. */
export async function pendenciasDaEmpregada(empregadoId: string, agora = new Date()) {
  const hoje = partesLocais(agora).data;
  const [e] = await buscarEmpregados({ id: empregadoId }, hoje);
  return e ? pendenciasPontoNaTela(e, agora, "EMPREGADO") : [];
}

/** Pedidos da empregada, agrupados por dia, com Aprovar/Recusar num toque. */
async function pedidosComBotoes(clienteId: string): Promise<PendenciaComAcoes[]> {
  const [ajustes, justificativas] = await Promise.all([
    prisma.ajustePonto.findMany({ where: { status: "PENDENTE", empregado: { clienteId } }, include: { empregado: { select: { nome: true } } }, orderBy: [{ data: "asc" }, { dataHora: "asc" }] }),
    prisma.justificativa.findMany({ where: { status: "PENDENTE", empregado: { clienteId } }, include: { empregado: { select: { nome: true } } }, orderBy: { data: "asc" } }),
  ]);
  const lista: PendenciaComAcoes[] = [];
  const grupos = new Map<string, typeof ajustes>();
  for (const a of ajustes) {
    const k = `${a.empregadoId}:${a.data.toISOString().slice(0, 10)}`;
    grupos.set(k, [...(grupos.get(k) ?? []), a]);
  }
  for (const [k, grupo] of grupos) {
    const [empregadoId, data] = k.split(":");
    const nome = grupo[0].empregado.nome.split(" ")[0];
    const horas = grupo.filter((a) => a.dataHora).map((a) => partesLocais(a.dataHora!).hora).join(", ");
    lista.push({
      chave: `pedido-ajuste:${k}`, para: "EMPREGADOR", link: "/cliente/ponto", acao: "Ver no ponto", urgente: true,
      titulo: `${nome} pediu ajuste no ponto de ${formatarData(grupo[0].data)}`,
      texto: `${grupo.some((a) => a.tipo === "DESCONSIDERAR") ? "Desconsiderar marcação errada" : `Incluir ${horas}`}. Motivo: ${grupo[0].justificativa.slice(0, 140)}`,
      opcoes: [
        { rotulo: "Aprovar", tipo: "DECIDIR_AJUSTES", dados: { empregadoId, data, decisao: "APROVADO" }, estilo: "sucesso" },
        { rotulo: "Recusar", tipo: "DECIDIR_AJUSTES", dados: { empregadoId, data, decisao: "REJEITADO" }, estilo: "secundario", confirmar: "Recusar o pedido? A empregada será avisada." },
      ],
    });
  }
  for (const j of justificativas) {
    const nome = j.empregado.nome.split(" ")[0];
    lista.push({
      chave: `pedido-justificativa:${j.id}`, para: "EMPREGADOR", link: "/cliente/ponto", acao: "Ver no ponto", urgente: true,
      titulo: `${nome} justificou ${j.dataFim ? `de ${formatarData(j.data)} a ${formatarData(j.dataFim)}` : `o dia ${formatarData(j.data)}`}`,
      texto: `${j.tipo.replace(/_/g, " ").toLowerCase()}: ${j.descricao.slice(0, 140)}${j.arquivoId ? " (com comprovante)" : ""}`,
      opcoes: [
        { rotulo: "Aceitar (não desconta)", tipo: "DECIDIR_JUSTIFICATIVA", dados: { id: j.id, decisao: "APROVADO" }, estilo: "sucesso" },
        ...(j.arquivoId ? [{ rotulo: "Ver comprovante", tipo: "LINK", link: `/api/arquivos/${j.arquivoId}`, estilo: "secundario" as const }] : []),
        { rotulo: "Recusar", tipo: "DECIDIR_JUSTIFICATIVA", dados: { id: j.id, decisao: "REJEITADO" }, estilo: "secundario", confirmar: "Recusar a justificativa? O dia poderá ser descontado." },
      ],
    });
  }
  return lista;
}

/** Fechamento do mês anterior (quem usa o app de ponto): resumo pronto e "Confirmar" num toque. */
async function fechamentosComBotoes(empregados: EmpregadoCompleto[], hoje: Date): Promise<PendenciaComAcoes[]> {
  const cfg = await configuracao();
  if (hoje.getUTCDate() > cfg.diaEmissaoGuias) return [];
  const comp = competenciaAnterior(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1);
  const lista: PendenciaComAcoes[] = [];
  for (const e of empregados) {
    if (e.admissao > ultimoDiaMes(comp.ano, comp.mes)) continue;
    const c = await prisma.competencia.findUnique({ where: { empregadoId_ano_mes: { empregadoId: e.id, ano: comp.ano, mes: comp.mes } } });
    if (c?.infoRecebida) continue;
    const nome = e.nome.split(" ")[0];
    const competencia = formatarCompetencia(comp.ano, comp.mes);
    const esp = e.pontoAtivo ? await espelhoDoMes(e, comp.ano, comp.mes, ultimoDiaMes(comp.ano, comp.mes)) : null;
    // Sem app de ponto (ou sem nenhuma marcação no mês, ex.: começou a usar depois): o mês precisa ser informado
    if (!esp || (esp.marcacoes.length === 0 && esp.ajustes.length === 0)) {
      lista.push({ chave: `fechamento:${e.id}:${competencia}`, para: "EMPREGADOR", link: "/cliente/informar", acao: "Informar o mês", urgente: true, titulo: `Informe o mês de ${competencia} — ${nome}`, texto: `${esp ? "Não há marcações de ponto neste mês" : "Ela não usa o app de ponto"}: informe as faltas, horas extras e adiantamento para o consultor fazer a folha.` });
      continue;
    }
    const pendentes = esp.dias.filter((d) => d.inconsistencias.some((i) => i.includes("ímpar"))).length;
    lista.push({
      chave: `fechamento:${e.id}:${competencia}`, para: "EMPREGADOR", link: `/cliente/ponto?empregado=${e.id}&ano=${comp.ano}&mes=${comp.mes}`, acao: "Ver o ponto do mês", urgente: true,
      titulo: `Feche o ponto de ${competencia} — ${nome}`,
      texto: `${resumoDoMes(esp)}${pendentes ? ` Atenção: ${pendentes} dia(s) incompleto(s) — resolva antes ou serão descontados.` : ""} Confirme para o consultor fazer a folha.`,
      opcoes: [{ rotulo: "Confirmar e enviar ao consultor", tipo: "FECHAR_MES", dados: { empregadoId: e.id, ano: String(comp.ano), mes: String(comp.mes) }, estilo: "sucesso", campo: { nome: "adiantamento", rotulo: "Adiantamento pago no mês (R$, se houve)" } }],
    });
  }
  return lista;
}

/** Botões de pendência na tela do patrão: fechamento do mês, pedidos, ponto dos empregados e DAE. */
export async function pendenciasDoPatrao(clienteId: string, agora = new Date()): Promise<PendenciaPatrao[]> {
  const hoje = partesLocais(agora).data;
  const lista: PendenciaPatrao[] = [];
  const empregados = await buscarEmpregados({ clienteId }, hoje);
  const local = await prisma.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { localLatitude: true } });
  if (local.localLatitude === null && empregados.some((e) => e.pontoAtivo && e.exigirLocalizacao)) {
    lista.push({ chave: `local-casa:${clienteId}`, para: "EMPREGADOR", link: "/cliente/local", acao: "Marcar o local da casa", urgente: true, titulo: "Marque o local da casa", texto: "Vá até o meio da casa e toque no botão: a empregada passa a marcar o ponto pelo GPS, só dentro da casa." });
  }
  lista.push(...(await fechamentosComBotoes(empregados, hoje)));
  lista.push(...(await pedidosComBotoes(clienteId)));
  // DAE da competência anterior (vence dia 7): botão a partir de 5 dias antes até ser pago
  const comp = competenciaAnterior(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1);
  const venc = vencimentoDae(comp.ano, comp.mes);
  const dias = diferencaDias(hoje, venc);
  const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { plano: true } });
  // Plano Plus: o patrão paga uma cobrança só (mensalidade + DAE) e a consultoria paga o DAE por ele
  const cobrancaPlus = cliente.plano === "PLUS" ? await prisma.mensalidade.findFirst({ where: { clienteId, status: "ABERTO", valorDae: { gt: 0 } }, orderBy: { vencimento: "asc" } }) : null;
  if (cobrancaPlus) {
    const dv = diferencaDias(hoje, cobrancaPlus.vencimento);
    lista.push({
      chave: `plus-cobranca:${cobrancaPlus.id}`, para: "EMPREGADOR", link: "/cliente/mensalidade", acao: "Pagar agora", urgente: dv <= 0,
      titulo: dv < 0 ? "Cobrança do mês em atraso (mensalidade + DAE)" : dv === 0 ? "Hoje vence a cobrança do mês" : `Cobrança do mês vence em ${dv} dia(s)`,
      texto: `${formatarMoeda(num(cobrancaPlus.valor) + num(cobrancaPlus.valorDae))}, vencimento ${formatarData(cobrancaPlus.vencimento)}. Com o pagamento, a consultoria paga o DAE por você${dv < 0 ? " — sem ele, o DAE fica em atraso e gera multa" : ""}.`,
    });
  }
  const competencias = cliente.plano === "PLUS" ? [] : await prisma.competencia.findMany({ where: { ano: comp.ano, mes: comp.mes, daeEmitido: true, pagamentoConfirmado: false, clienteInformouPagamentoEm: null, empregado: { clienteId } }, include: { empregado: { select: { nome: true } } } });
  for (const c of competencias) {
    if (dias > 5) continue;
    const valor = c.daeValor ? ` de ${formatarMoeda(num(c.daeValor))}` : "";
    lista.push({
      chave: `dae:${c.id}`, para: "EMPREGADOR", link: "/cliente/dae", acao: "Ver o DAE e o código de barras", urgente: dias <= 0,
      titulo: dias < 0 ? `DAE em atraso — ${c.empregado.nome.split(" ")[0]}` : dias === 0 ? `Hoje é dia de pagar o DAE — ${c.empregado.nome.split(" ")[0]}` : `DAE vence em ${dias} dia(s) — ${c.empregado.nome.split(" ")[0]}`,
      texto: `Competência ${formatarCompetencia(c.ano, c.mes)}${valor}, vencimento ${formatarData(venc)}. Pague no app do banco e confirme aqui.`,
      opcoes: [{ rotulo: "Já paguei", tipo: "DAE_PAGO", dados: { competenciaId: c.id }, estilo: "sucesso", confirmar: "Confirmar que o DAE foi pago? O consultor vai conferir." }],
    });
  }
  for (const e of empregados) lista.push(...(await pendenciasPontoNaTela(e, agora, "EMPREGADOR")));
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
    // Horário flexível: pergunta ao patrão o horário de amanhã; às 21h, sem resposta, vale o horário de sempre
    if (e.horarioFlexivel) {
      const { amanha } = await diasDoEmpregado(e, hoje);
      const definida = e.escalas.find((x) => x.data.getTime() === amanha.data.getTime());
      if (!definida && amanha.diaDeTrabalho && amanha.entradaPrevista && amanha.previstoMinutos && partesLocais(agora).minutos >= 21 * 60) {
        const saida = saidaDaEscala(amanha.entradaPrevista, amanha.previstoMinutos, e.acordoIntervaloReduzido);
        e.escalas.push(await prisma.escalaDia.create({ data: { empregadoId: e.id, data: amanha.data, entrada: amanha.entradaPrevista, saida, automatica: true } }));
        amanha.saidaPrevista = saida;
      }
      const def = e.escalas.find((x) => x.data.getTime() === amanha.data.getTime());
      for (const l of lembretesEscala({ agora, nome: e.nome, amanha: { data: amanha.data, diaDeTrabalho: amanha.diaDeTrabalho, entrada: def?.entrada ?? amanha.entradaPrevista, saida: def?.saida ?? amanha.saidaPrevista, definida: Boolean(def) } })) {
        const aviso = { chave: `${e.id}:${l.chave}`, titulo: l.titulo, texto: l.texto, link: l.link, acao: l.acao };
        if (l.para === "EMPREGADO") {
          if (e.usuario?.ativo && (await notificar(e.usuario.id, aviso))) enviados++;
        } else for (const u of e.cliente.usuarios) if (await notificar(u.id, aviso)) enviados++;
      }
    }
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
  // Fechamento do mês anterior (app de ponto): lembra o patrão a cada hora até ele confirmar
  const cfg = await configuracao();
  if (hoje.getUTCDate() <= cfg.diaEmissaoGuias) {
    const comp = competenciaAnterior(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1);
    for (const e of empregados.filter((x) => x.pontoAtivo && x.admissao <= ultimoDiaMes(comp.ano, comp.mes))) {
      const c = await prisma.competencia.findUnique({ where: { empregadoId_ano_mes: { empregadoId: e.id, ano: comp.ano, mes: comp.mes } } });
      if (c?.infoRecebida) continue;
      const previa = lembretesFechamento({ agora, competencia: formatarCompetencia(comp.ano, comp.mes), fechado: false, diaLimite: cfg.diaEmissaoGuias, nome: e.nome, resumo: "" });
      if (!previa.length) continue;
      const esp = await espelhoDoMes(e, comp.ano, comp.mes, ultimoDiaMes(comp.ano, comp.mes));
      const semMarcacoes = esp.marcacoes.length === 0 && esp.ajustes.length === 0;
      for (const l of lembretesFechamento({ agora, competencia: formatarCompetencia(comp.ano, comp.mes), fechado: false, diaLimite: cfg.diaEmissaoGuias, nome: e.nome, resumo: semMarcacoes ? "Não há marcações de ponto neste mês: informe as faltas e horas extras." : resumoDoMes(esp) })) {
        for (const u of e.cliente.usuarios) if (await notificar(u.id, { ...l, chave: `${e.id}:${l.chave}` })) enviados++;
      }
    }
  }
  // Plano Plus: cobrança do mês (mensalidade + DAE) ainda não paga
  for (const m of await prisma.mensalidade.findMany({ where: { status: "ABERTO", valorDae: { gt: 0 }, cliente: { plano: "PLUS", ativo: true } }, include: { cliente: { select: { usuarios: { where: { papel: "CLIENTE", ativo: true }, select: { id: true } } } } } })) {
    for (const l of lembretesCobrancaPlus({ agora, vencimento: m.vencimento, total: formatarMoeda(num(m.valor) + num(m.valorDae)) })) {
      for (const u of m.cliente.usuarios) if (await notificar(u.id, { ...l, chave: `${m.id}:${l.chave}` })) enviados++;
    }
  }
  return { empregados: empregados.length, enviados };
}

/** Rotina diária: lembretes do DAE (3 dias antes, no dia e em atraso). */
export async function rodarLembretesDiarios(hoje = hojeBrasil()) {
  let enviados = 0;
  const comp = competenciaAnterior(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1);
  const venc = vencimentoDae(comp.ano, comp.mes);
  const competencias = await prisma.competencia.findMany({
    // Plano Plus fica de fora: a consultoria paga o DAE (o lembrete é o da cobrança do mês)
    where: { ano: comp.ano, mes: comp.mes, daeEmitido: true, empregado: { cliente: { plano: { not: "PLUS" } } } },
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
