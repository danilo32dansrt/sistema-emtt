import { addAnos, addDias, addMeses, diferencaDias, formatarData, soData } from "./datas";
import { aplicarModo, arred, formatarMoeda, somar } from "./dinheiro";
import { calcularInssEmpregado } from "./inss";
import { Memoria } from "./memoria";
import type { Regime } from "./salario";
import type { TabelaAnual } from "./tabelas";

export type StatusPeriodo = "EM_AQUISICAO" | "A_GOZAR" | "VENCIDO" | "GOZADO";

export interface PeriodoFerias {
  numero: number;
  inicioAquisitivo: Date;
  fimAquisitivo: Date;
  fimConcessivo: Date;
  diasGozados: number;
  status: StatusPeriodo;
  /** Dias até o fim do concessivo (negativo = vencido). */
  diasParaVencer: number;
}

export interface FeriasGozadas {
  inicioAquisitivo: Date;
  dias: number;
}

/** Lista os períodos aquisitivos/concessivos desde a admissão até a data de referência. */
export function periodosFerias(
  admissao: Date,
  referencia: Date,
  gozadas: FeriasGozadas[] = [],
  diasDireito = 30,
): PeriodoFerias[] {
  const lista: PeriodoFerias[] = [];
  const ref = soData(referencia);
  for (let n = 0; ; n++) {
    const inicio = addAnos(soData(admissao), n);
    if (inicio.getTime() > ref.getTime()) break;
    const fimAquisitivo = addDias(addAnos(inicio, 1), -1);
    const fimConcessivo = addAnos(fimAquisitivo, 1);
    const diasGozados = gozadas
      .filter((g) => soData(g.inicioAquisitivo).getTime() === inicio.getTime())
      .reduce((t, g) => t + g.dias, 0);
    let status: StatusPeriodo;
    if (fimAquisitivo.getTime() >= ref.getTime()) status = "EM_AQUISICAO";
    else if (diasGozados >= diasDireito) status = "GOZADO";
    else if (fimConcessivo.getTime() < ref.getTime()) status = "VENCIDO";
    else status = "A_GOZAR";
    lista.push({
      numero: n + 1,
      inicioAquisitivo: inicio,
      fimAquisitivo,
      fimConcessivo,
      diasGozados,
      status,
      diasParaVencer: diferencaDias(ref, fimConcessivo),
    });
  }
  return lista;
}

/** Tabela do art. 3º, § 3º, da LC 150/2015 para tempo parcial. */
export function diasFeriasParcialLC150(horasSemanais: number): number {
  if (horasSemanais > 22) return 18;
  if (horasSemanais > 20) return 16;
  if (horasSemanais > 15) return 14;
  if (horasSemanais > 10) return 12;
  if (horasSemanais > 5) return 10;
  return 8;
}

/** CLT art. 130 (aplicação subsidiária): redução pelas faltas injustificadas no período aquisitivo. */
export function diasFeriasPorFaltas(faltasInjustificadas: number): number {
  if (faltasInjustificadas <= 5) return 30;
  if (faltasInjustificadas <= 14) return 24;
  if (faltasInjustificadas <= 23) return 18;
  if (faltasInjustificadas <= 32) return 12;
  return 0;
}

export type RegraFeriasParcial = "LC150" | "CLT";

export function diasDireitoFerias(
  regime: Regime,
  horasSemanais: number,
  faltasInjustificadas = 0,
  regraParcial: RegraFeriasParcial = "CLT",
) {
  if (regime === "PARCIAL" && regraParcial === "LC150") {
    return {
      dias: diasFeriasParcialLC150(horasSemanais),
      fundamento: "LC 150/2015, art. 3º, § 3º (tabela do tempo parcial)",
    };
  }
  const dias = diasFeriasPorFaltas(faltasInjustificadas);
  return {
    dias,
    fundamento:
      faltasInjustificadas > 5
        ? `CLT art. 130 — ${faltasInjustificadas} faltas injustificadas reduzem para ${dias} dias`
        : "LC 150/2015, art. 17 — 30 dias",
  };
}

/** Avos de férias proporcionais: meses completos desde o início do aquisitivo; fração de 15 dias ou mais conta 1. */
export function avosFerias(inicioAquisitivo: Date, fim: Date): number {
  const ini = soData(inicioAquisitivo);
  const f = soData(fim);
  if (f.getTime() < ini.getTime()) return 0;
  let meses = 0;
  while (meses < 12 && addDias(addMeses(ini, meses + 1), -1).getTime() <= f.getTime()) meses++;
  if (meses < 12) {
    const restante = diferencaDias(addMeses(ini, meses), f) + 1;
    if (restante >= 15) meses++;
  }
  return Math.min(12, meses);
}

export function validarFracionamento(periodos: number[], diasDireito: number, diasAbono = 0): string[] {
  const erros: string[] = [];
  const validos = periodos.filter((p) => p > 0);
  if (validos.length === 0) erros.push("Informe ao menos um período de gozo.");
  if (validos.length > 2) erros.push("As férias do doméstico podem ser divididas em no máximo 2 períodos (LC 150, art. 17, § 2º).");
  if (validos.length === 2 && Math.max(...validos) < 14) erros.push("Um dos períodos deve ter no mínimo 14 dias corridos.");
  if (diasAbono > Math.floor(diasDireito / 3)) erros.push(`O abono pecuniário é de no máximo 1/3 das férias (${Math.floor(diasDireito / 3)} dias).`);
  const soma = validos.reduce((a, b) => a + b, 0) + diasAbono;
  if (soma > diasDireito) erros.push(`Gozo + abono (${soma} dias) passa do direito (${diasDireito} dias).`);
  return erros;
}

export interface EntradaFerias {
  salario: number;
  mediaVariaveis?: number;
  diasGozo: number;
  diasAbono?: number;
  inicioGozo?: Date;
  /** Férias pagas fora do período concessivo: valor em dobro (CLT art. 137). */
  emDobro?: boolean;
  tabela: TabelaAnual;
}

export function calcularFerias(e: EntradaFerias) {
  const memoria = new Memoria();
  const remuneracao = somar(e.salario, e.mediaVariaveis ?? 0);
  const fator = e.emDobro ? 2 : 1;
  const dia = remuneracao / 30;

  const ferias = arred(dia * e.diasGozo * fator);
  const terco = arred(ferias / 3);
  memoria.add("Remuneração base", remuneracao);
  memoria.add(`Férias (${e.diasGozo} dias)${e.emDobro ? " em dobro" : ""}`, ferias, `${formatarMoeda(remuneracao)} ÷ 30 × ${e.diasGozo}${e.emDobro ? " × 2" : ""}`);
  memoria.add("1/3 constitucional", terco, `${formatarMoeda(ferias)} ÷ 3`);

  const diasAbono = e.diasAbono ?? 0;
  const abono = arred(dia * diasAbono);
  const tercoAbono = arred(abono / 3);
  if (diasAbono) {
    memoria.add(`Abono pecuniário (${diasAbono} dias vendidos)`, abono, `${formatarMoeda(remuneracao)} ÷ 30 × ${diasAbono}`);
    memoria.add("1/3 sobre o abono", tercoAbono);
    memoria.nota("Abono pecuniário e seu 1/3 não têm INSS nem FGTS.");
  }

  const baseInss = somar(ferias, terco);
  const inss = calcularInssEmpregado(baseInss, e.tabela);
  memoria.add("INSS sobre férias + 1/3", inss.valor, "na folha, soma-se ao salário do mês para o cálculo final");

  const a = e.tabela.aliquotas;
  const modo = e.tabela.arredondamentoDae;
  const fgts = aplicarModo((baseInss * a.fgts) / 100, modo) + aplicarModo((baseInss * a.fgtsCompensatorio) / 100, modo);
  memoria.add(`FGTS (${a.fgts + a.fgtsCompensatorio}%) sobre férias + 1/3`, arred(fgts));

  const bruto = somar(ferias, terco, abono, tercoAbono);
  const liquido = somar(bruto, -inss.valor);
  memoria.destaque("Líquido de férias", liquido);

  let prazos: { aviso: Date; pagamento: Date; retorno: Date; fim: Date } | undefined;
  if (e.inicioGozo) {
    const fim = addDias(e.inicioGozo, e.diasGozo - 1);
    prazos = {
      aviso: addDias(e.inicioGozo, -30),
      pagamento: addDias(e.inicioGozo, -2),
      fim,
      retorno: addDias(fim, 1),
    };
    memoria.nota(`Avisar o empregado por escrito até ${formatarData(prazos.aviso)} e pagar até ${formatarData(prazos.pagamento)}. Retorno em ${formatarData(prazos.retorno)}.`);
  }

  return { remuneracao, ferias, terco, abono, tercoAbono, bruto, inss: inss.valor, fgts: arred(fgts), liquido, prazos, memoria };
}
