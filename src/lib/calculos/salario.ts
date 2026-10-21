import {
  type DiaSemana,
  DIAS_SEMANA,
  addDias,
  diaSemana,
  diasInclusivos,
  diasNoMes,
  maxData,
  minData,
  primeiroDiaMes,
  soData,
  ultimoDiaMes,
} from "./datas";
import { arred, formatarMoeda, formatarNumero } from "./dinheiro";
import { Memoria } from "./memoria";

export type Regime = "INTEGRAL" | "PARCIAL" | "DOZE_X_TRINTA_SEIS";

export const NOMES_REGIME: Record<Regime, string> = {
  INTEGRAL: "Integral (até 44h semanais)",
  PARCIAL: "Tempo parcial (até 25h semanais)",
  DOZE_X_TRINTA_SEIS: "12x36",
};

/** Horas previstas por dia da semana (ex.: { seg: 8, ter: 8, ... }). */
export type JornadaSemanal = Partial<Record<DiaSemana, number>>;

export function horasSemanaisDaJornada(j: JornadaSemanal): number {
  return arred(DIAS_SEMANA.reduce((t, d) => t + (j[d] ?? 0), 0), 2);
}

export function diasTrabalhadosPorSemana(j: JornadaSemanal): number {
  return DIAS_SEMANA.filter((d) => (j[d] ?? 0) > 0).length;
}

export function maiorJornadaDiaria(j: JornadaSemanal): number {
  return Math.max(0, ...DIAS_SEMANA.map((d) => j[d] ?? 0));
}

/** Horas mensais = horas semanais × 5 (44h → 220h), regra usada pelo eSocial. */
export function horasMensais(horasSemanais: number): number {
  return arred(horasSemanais * 5, 2);
}

/** Salário mínimo proporcional: mínimo ÷ 220 × horas mensais. */
export function salarioMinimoProporcional(salarioMinimo: number, horasSemanais: number): number {
  const h = Math.min(horasMensais(horasSemanais), 220);
  return arred((salarioMinimo / 220) * h);
}

/** Período do mês em que houve vínculo (considera admissão e desligamento). */
export function periodoTrabalhadoNoMes(ano: number, mes: number, admissao: Date, desligamento?: Date | null) {
  const inicio = maxData(primeiroDiaMes(ano, mes), soData(admissao));
  const fim = desligamento ? minData(ultimoDiaMes(ano, mes), soData(desligamento)) : ultimoDiaMes(ano, mes);
  const dias = fim.getTime() < inicio.getTime() ? 0 : diasInclusivos(inicio, fim);
  return { inicio, fim, dias, diasMes: diasNoMes(ano, mes), mesCompleto: dias === diasNoMes(ano, mes) };
}

/** Salário proporcional: salário ÷ dias do mês × dias trabalhados (como o eSocial). */
export function salarioProporcional(salario: number, diasTrabalhados: number, diasDoMes: number) {
  const valor = diasTrabalhados >= diasDoMes ? salario : arred((salario / diasDoMes) * diasTrabalhados);
  return {
    valor,
    formula: `${formatarMoeda(salario)} ÷ ${diasDoMes} dias × ${diasTrabalhados} dias`,
  };
}

export function valorHora(salario: number, horasSemanais: number): number {
  const h = horasMensais(horasSemanais);
  return h > 0 ? salario / h : 0;
}

export function valorDia(salario: number): number {
  return salario / 30;
}

/** Hora extra com adicional (50% padrão; 100% domingos/feriados não compensados). */
export function valorHorasExtras(salario: number, horasSemanais: number, horas: number, adicional = 50) {
  const vh = valorHora(salario, horasSemanais);
  const valor = arred(vh * (1 + adicional / 100) * horas);
  return {
    valor,
    formula: `${formatarMoeda(arred(vh, 4))}/h × ${1 + adicional / 100} × ${formatarNumero(horas)} h`,
  };
}

/** Adicional noturno (mínimo 20%) sobre as horas noturnas já convertidas (hora de 52min30s). */
export function valorAdicionalNoturno(salario: number, horasSemanais: number, horasNoturnas: number, adicional = 20) {
  const vh = valorHora(salario, horasSemanais);
  return {
    valor: arred(vh * (adicional / 100) * horasNoturnas),
    formula: `${formatarMoeda(arred(vh, 4))}/h × ${adicional}% × ${formatarNumero(horasNoturnas)} h`,
  };
}

/** Reflexo do DSR sobre variáveis (Súmula 172 TST): valor ÷ dias úteis × domingos e feriados. */
export function reflexoDsr(valorVariaveis: number, diasUteis: number, diasDescanso: number) {
  return {
    valor: diasUteis > 0 ? arred((valorVariaveis / diasUteis) * diasDescanso) : 0,
    formula: `${formatarMoeda(valorVariaveis)} ÷ ${diasUteis} dias úteis × ${diasDescanso} domingos/feriados`,
  };
}

/**
 * Desconto de faltas injustificadas: cada falta desconta 1 dia (salário ÷ 30) e cada
 * semana com falta injustificada desconta também o DSR (mais 1 dia).
 */
export function descontoFaltas(salario: number, faltasDias: number, semanasComFalta: number) {
  const dia = valorDia(salario);
  const faltas = arred(dia * faltasDias);
  const dsr = arred(dia * semanasComFalta);
  const memoria = new Memoria();
  if (faltasDias > 0) memoria.add("Faltas injustificadas", faltas, `${formatarMoeda(arred(dia, 4))}/dia × ${faltasDias} dia(s)`);
  if (semanasComFalta > 0) memoria.add("DSR perdido", dsr, `${formatarMoeda(arred(dia, 4))}/dia × ${semanasComFalta} semana(s) com falta`);
  return { faltas, dsr, total: arred(faltas + dsr), memoria };
}

/** Desconto de atrasos em minutos. */
export function descontoAtrasos(salario: number, horasSemanais: number, minutos: number) {
  const vh = valorHora(salario, horasSemanais);
  return { valor: arred((vh * minutos) / 60), formula: `${formatarMoeda(arred(vh, 4))}/h × ${minutos} min ÷ 60` };
}

/** Conta quantas semanas (domingo a sábado) distintas têm ao menos uma falta. */
export function semanasDistintas(datas: Date[]): number {
  const chaves = new Set(datas.map((d) => addDias(soData(d), -diaSemana(d)).getTime()));
  return chaves.size;
}
