import { type DiaSemana, DIAS_SEMANA, addDias, data, diaSemana, ehFeriado, horaParaMinutos, minutosParaHora } from "./datas";
import { arred } from "./dinheiro";
import type { ParametrosJornada } from "./parametros";
import { LIMITES_JORNADA_PADRAO } from "./parametros-padrao";
import { type JornadaSemanal, type Regime, semanasDistintas } from "./salario";

/**
 * O que fazer com as horas que faltaram no dia (decisão do empregador, registrada com o motivo):
 * ABONAR (não desconta), COMPENSAR (repor com horas a mais — só no integral com acordo escrito)
 * ou DESCONTAR (padrão).
 */
export type TratamentoAusencia = "ABONAR" | "COMPENSAR" | "DESCONTAR";

/** Fuso de Brasília (sem horário de verão desde 2019). */
export const OFFSET_BRASILIA_MIN = -180;

/** Converte um instante (UTC) em data local + minutos desde a meia-noite de Brasília. */
export function partesLocais(instante: Date) {
  const local = new Date(instante.getTime() + OFFSET_BRASILIA_MIN * 60_000);
  return {
    data: data(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate()),
    minutos: local.getUTCHours() * 60 + local.getUTCMinutes() + local.getUTCSeconds() / 60,
    hora: `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`,
  };
}

/** Instante UTC correspondente a uma data local + "HH:MM" de Brasília. */
export function instanteLocal(dia: Date, hhmm: string): Date {
  return new Date(dia.getTime() + horaParaMinutos(hhmm) * 60_000 - OFFSET_BRASILIA_MIN * 60_000);
}

/** Minutos da marcação em relação à meia-noite local do dia da jornada (pode passar de 1440). */
function minutosRelativos(dia: Date, instante: Date): number {
  return (instante.getTime() - (dia.getTime() - OFFSET_BRASILIA_MIN * 60_000)) / 60_000;
}

export interface ConfigJornada {
  regime: Regime;
  horasSemanais: number;
  jornada: JornadaSemanal;
  /** Horário previsto de entrada/saída por dia (para a tolerância por marcação). */
  horarios?: Partial<Record<DiaSemana, { entrada: string; saida: string }>>;
  toleranciaMarcacao?: number;
  toleranciaDiaria?: number;
  /** Acordo escrito de compensação/banco de horas (LC 150, art. 2º, § 5º). */
  acordoCompensacao?: boolean;
  /** Acordo escrito para reduzir o intervalo para 30 minutos (LC 150, art. 13). */
  acordoIntervaloReduzido?: boolean;
  /** Empregado que reside no local de trabalho (intervalo pode ser fracionado). */
  residenteNoLocal?: boolean;
  /** Limites legais vigentes (tabela de parâmetros). */
  limites?: ParametrosJornada;
}

export interface EntradaDia {
  data: Date;
  /** Instantes das marcações (UTC), em qualquer ordem. */
  marcacoes: Date[];
  config: ConfigJornada;
  /** Minutos previstos no dia (substitui a jornada semanal — usado na escala 12x36). */
  previstoMinutos?: number;
  feriadosExtras?: Date[];
  /** Ausência justificada/abonada (atestado etc.): não gera desconto. */
  abonado?: boolean;
  /** Dia em viagem de acompanhamento (adicional de 25%). */
  viagem?: boolean;
  /** Decisão do empregador sobre as horas que faltaram no dia. */
  tratamento?: TratamentoAusencia;
  /** Última saída da jornada anterior (para checar as 11h de interjornada). */
  ultimaSaidaAnterior?: Date | null;
}

export interface ResultadoDia {
  data: Date;
  previsto: number;
  trabalhadoReal: number;
  noturnoReal: number;
  noturnoConvertido: number;
  trabalhadoComputado: number;
  intervalo: number;
  intervaloSuprimido: number;
  extras50: number;
  extras100: number;
  atraso: number;
  /** Horas que faltaram e que o empregador decidiu compensar (minutos). */
  aCompensar: number;
  falta: boolean;
  faltaJustificada: boolean;
  viagem: number;
  domingoOuFeriado: boolean;
  inconsistencias: string[];
  pares: { entrada: string; saida: string }[];
}

const JANELAS_NOTURNAS = [[-120, 300], [1320, 1740], [2760, 3180]] as const;

function sobreposicao(a: number, b: number, c: number, d: number) {
  return Math.max(0, Math.min(b, d) - Math.max(a, c));
}

export function calcularDia(e: EntradaDia): ResultadoDia {
  const cfg = e.config;
  const L = cfg.limites ?? LIMITES_JORNADA_PADRAO;
  const abonado = e.abonado || e.tratamento === "ABONAR";
  const tolMarc = cfg.toleranciaMarcacao ?? 5;
  const tolDia = cfg.toleranciaDiaria ?? 10;
  const ds = DIAS_SEMANA[diaSemana(e.data)];
  const previsto = e.previstoMinutos ?? Math.round((cfg.jornada[ds] ?? 0) * 60);
  const feriado = ehFeriado(e.data, e.feriadosExtras);
  const domingoOuFeriado = feriado || diaSemana(e.data) === 0;
  const inconsistencias: string[] = [];

  const ordenadas = [...e.marcacoes].sort((a, b) => a.getTime() - b.getTime());
  const mins = ordenadas.map((m) => minutosRelativos(e.data, m));
  if (mins.length % 2 === 1) inconsistencias.push("Número ímpar de marcações — falta registrar uma entrada ou saída.");

  const pares: [number, number][] = [];
  for (let i = 0; i + 1 < mins.length; i += 2) pares.push([mins[i], mins[i + 1]]);

  let trabalhadoReal = 0;
  let noturnoReal = 0;
  for (const [a, b] of pares) {
    trabalhadoReal += b - a;
    for (const [c, d] of JANELAS_NOTURNAS) noturnoReal += sobreposicao(a, b, c, d);
  }
  let intervalo = 0;
  for (let i = 1; i < pares.length; i++) intervalo += pares[i][0] - pares[i - 1][1];

  trabalhadoReal = Math.round(trabalhadoReal);
  noturnoReal = Math.round(noturnoReal);
  intervalo = Math.round(intervalo);
  const noturnoConvertido = arred((noturnoReal * 60) / 52.5, 2);
  const trabalhadoComputado = Math.round(trabalhadoReal - noturnoReal + noturnoConvertido);

  // Intervalo intrajornada (LC 150, art. 13; CLT art. 71)
  let intervaloSuprimido = 0;
  if (trabalhadoReal > 360) {
    const minimo = cfg.acordoIntervaloReduzido ? 30 : 60;
    if (intervalo < minimo) {
      intervaloSuprimido = minimo - intervalo;
      inconsistencias.push(`Intervalo de ${intervalo} min, abaixo do mínimo de ${minimo} min para jornada acima de 6h.`);
    }
    if (intervalo > 120 && !cfg.residenteNoLocal) inconsistencias.push("Intervalo acima de 2h (permitido só para quem reside no local).");
  } else if (trabalhadoReal > 240 && intervalo < 15) {
    intervaloSuprimido = 15 - intervalo;
    inconsistencias.push("Jornada entre 4h e 6h exige intervalo de 15 minutos.");
  }

  // Interjornada (art. 15)
  if (e.ultimaSaidaAnterior && ordenadas.length) {
    const descanso = (ordenadas[0].getTime() - e.ultimaSaidaAnterior.getTime()) / 60_000;
    if (descanso < 660) inconsistencias.push(`Descanso entre jornadas de ${minutosParaHora(descanso)}, abaixo de 11h.`);
  }

  let extras50 = 0;
  let extras100 = 0;
  let atraso = 0;
  let aCompensar = 0;
  let falta = false;
  let faltaJustificada = false;

  if (ordenadas.length === 0) {
    if (previsto > 0) {
      if (abonado) faltaJustificada = true;
      else if (e.tratamento === "COMPENSAR") aCompensar = previsto;
      else falta = true;
    }
  } else if (previsto === 0 && domingoOuFeriado && cfg.regime !== "DOZE_X_TRINTA_SEIS") {
    extras100 = trabalhadoComputado;
    inconsistencias.push("Trabalho em domingo/feriado não compensado: pago em dobro.");
  } else {
    let diferenca = trabalhadoComputado - previsto;
    const h = cfg.horarios?.[ds];
    if (h && mins.length >= 2) {
      const varEntrada = Math.abs(mins[0] - horaParaMinutos(h.entrada));
      const saidaPrevista = horaParaMinutos(h.saida) + (horaParaMinutos(h.saida) < horaParaMinutos(h.entrada) ? 1440 : 0);
      const varSaida = Math.abs(mins[mins.length - 1] - saidaPrevista);
      if (varEntrada <= tolMarc && varSaida <= tolMarc && varEntrada + varSaida <= tolDia) diferenca = 0;
    } else if (Math.abs(diferenca) <= tolDia) {
      diferenca = 0;
    }
    if (diferenca > 0) extras50 = diferenca;
    else if (diferenca < 0) {
      if (abonado) faltaJustificada = true;
      else if (e.tratamento === "COMPENSAR") aCompensar = -diferenca;
      else atraso = -diferenca;
    }
  }

  // Limites legais por regime
  if (cfg.regime === "INTEGRAL" && trabalhadoComputado > L.limiteDiario * 60) inconsistencias.push(`Jornada acima de ${L.limiteDiario}h no dia (limite com as horas extras).`);
  if (cfg.regime === "PARCIAL") {
    if (trabalhadoComputado > L.parcialDiariaMax * 60) inconsistencias.push(`Tempo parcial: jornada acima de ${L.parcialDiariaMax}h diárias.`);
    if (extras50 > L.parcialExtraDiaria * 60) inconsistencias.push(`Tempo parcial: hora extra limitada a ${L.parcialExtraDiaria}h por dia.`);
  }
  if (cfg.regime === "DOZE_X_TRINTA_SEIS" && trabalhadoComputado > L.doze36Max * 60 + tolDia) inconsistencias.push(`Escala 12x36: jornada acima de ${L.doze36Max}h.`);

  const pares2 = pares.map(([a, b]) => ({ entrada: minutosParaHora(a % 1440), saida: minutosParaHora(b % 1440) }));
  return {
    data: e.data,
    previsto,
    trabalhadoReal,
    noturnoReal,
    noturnoConvertido,
    trabalhadoComputado,
    intervalo,
    intervaloSuprimido,
    extras50,
    extras100,
    atraso,
    aCompensar,
    falta,
    faltaJustificada,
    viagem: e.viagem ? trabalhadoComputado : 0,
    domingoOuFeriado,
    inconsistencias,
    pares: pares2,
  };
}

/** Agrupa marcações em jornadas: uma nova jornada começa após 6h sem marcação (com pares fechados) ou 16h em qualquer caso. */
export function agruparJornadas(instantes: Date[]): { data: Date; marcacoes: Date[] }[] {
  const ordenadas = [...instantes].sort((a, b) => a.getTime() - b.getTime());
  const grupos: { data: Date; marcacoes: Date[] }[] = [];
  for (const m of ordenadas) {
    const atual = grupos[grupos.length - 1];
    if (atual) {
      const ultimo = atual.marcacoes[atual.marcacoes.length - 1];
      const gap = (m.getTime() - ultimo.getTime()) / 60_000;
      const fechado = atual.marcacoes.length % 2 === 0;
      if (!((fechado && gap >= 360) || gap >= 960)) {
        atual.marcacoes.push(m);
        continue;
      }
    }
    grupos.push({ data: partesLocais(m).data, marcacoes: [m] });
  }
  return grupos;
}

export interface ResumoMes {
  dias: ResultadoDia[];
  previsto: number;
  trabalhado: number;
  extras50: number;
  extras100: number;
  noturno: number;
  atraso: number;
  faltas: number;
  faltasJustificadas: number;
  semanasComFalta: number;
  intervaloSuprimido: number;
  viagem: number;
  /** Banco de horas (minutos). */
  compensado: number;
  extrasPagas50: number;
  paraBanco: number;
  atrasoDescontado: number;
  /** Horas que o empregador marcou para compensar no mês (minutos). */
  aCompensar: number;
  inconsistencias: number;
  /** Explicações em linguagem simples sobre a regra aplicada. */
  observacoes: string[];
}

/**
 * Consolida o mês conforme o regime (LC 150):
 * - INTEGRAL com acordo escrito de compensação (art. 2º, §§ 4º e 5º): as horas não trabalhadas no mês
 *   (atrasos, saídas antecipadas e dias marcados para compensar) são abatidas das horas extras do mês,
 *   hora por hora; das extras que sobram, as primeiras 40h são pagas e o excedente vai para o banco
 *   (compensável em até 1 ano). O que ficar devendo no fim do mês é descontado — não se leva dívida
 *   de horas para o mês seguinte nem para a rescisão.
 * - TEMPO PARCIAL (art. 3º, § 2º) e 12x36: a lei não prevê compensação. Hora a menos é descontada
 *   (ou abonada) e hora a mais é paga com adicional, sem trocar uma pela outra.
 */
export function consolidarMes(dias: ResultadoDia[], config: ConfigJornada, saldoBancoAnterior = 0): ResumoMes {
  const L = config.limites ?? LIMITES_JORNADA_PADRAO;
  const soma = (f: (d: ResultadoDia) => number) => dias.reduce((t, d) => t + f(d), 0);
  const extras50 = soma((d) => d.extras50);
  const atraso = soma((d) => d.atraso);
  const aCompensar = soma((d) => d.aCompensar);
  const datasFalta = dias.filter((d) => d.falta).map((d) => d.data);
  const observacoes: string[] = [];

  let compensado = 0;
  let extrasPagas50 = extras50;
  let paraBanco = 0;
  let atrasoDescontado = atraso + aCompensar;
  const permiteCompensacao = config.regime === "INTEGRAL" && Boolean(config.acordoCompensacao);
  if (permiteCompensacao) {
    const devido = atraso + aCompensar;
    compensado = Math.min(extras50, devido);
    const sobra = extras50 - compensado;
    atrasoDescontado = devido - compensado;
    extrasPagas50 = Math.min(sobra, L.bancoHorasPagasMes * 60);
    paraBanco = sobra - extrasPagas50;
    // Saldo positivo de meses anteriores (dentro do prazo de 1 ano) pode cobrir o que faltou
    if (saldoBancoAnterior > 0 && atrasoDescontado > 0) {
      const usar = Math.min(saldoBancoAnterior, atrasoDescontado);
      atrasoDescontado -= usar;
      paraBanco -= usar;
    }
    if (atrasoDescontado > 0 && aCompensar > 0) observacoes.push("Horas a compensar não repostas até o fim do mês foram descontadas.");
  } else {
    if (config.regime === "PARCIAL" && config.acordoCompensacao) observacoes.push("Tempo parcial: a LC 150 não prevê compensação; horas a menos são descontadas e horas a mais pagas com adicional.");
    if (aCompensar > 0) observacoes.push(config.regime === "INTEGRAL" ? "Sem acordo escrito de compensação: as horas marcadas para compensar foram descontadas." : "Neste regime não há compensação: as horas marcadas para compensar foram descontadas.");
  }

  return {
    dias,
    previsto: soma((d) => d.previsto),
    trabalhado: soma((d) => d.trabalhadoComputado),
    extras50,
    extras100: soma((d) => d.extras100),
    noturno: arred(soma((d) => d.noturnoConvertido), 2),
    atraso,
    aCompensar,
    faltas: datasFalta.length,
    faltasJustificadas: dias.filter((d) => d.faltaJustificada).length,
    semanasComFalta: semanasDistintas(datasFalta),
    intervaloSuprimido: soma((d) => d.intervaloSuprimido),
    viagem: soma((d) => d.viagem),
    compensado,
    extrasPagas50,
    paraBanco,
    atrasoDescontado,
    inconsistencias: soma((d) => d.inconsistencias.length),
    observacoes,
  };
}

/** Gera a lista de dias do mês com as jornadas encontradas (dias sem marcação também aparecem). */
export function diasDoMes(ano: number, mes: number): Date[] {
  const lista: Date[] = [];
  for (let d = data(ano, mes, 1); d.getUTCMonth() === mes - 1; d = addDias(d, 1)) lista.push(d);
  return lista;
}

/** Escala 12x36: dias de trabalho alternados a partir de uma data de referência. */
export function ehDiaDeTrabalho12x36(dia: Date, referencia: Date): boolean {
  const diff = Math.round((dia.getTime() - referencia.getTime()) / 86_400_000);
  return ((diff % 2) + 2) % 2 === 0;
}
