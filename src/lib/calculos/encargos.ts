import { aplicarModo, formatarMoeda, somar } from "./dinheiro";
import { calcularInssEmpregado } from "./inss";
import { Memoria } from "./memoria";
import type { TabelaAnual } from "./tabelas";

export interface EntradaEncargos {
  /** Remuneração do mês que serve de base para INSS e FGTS (salário + extras + adicionais − faltas). */
  baseInss: number;
  /** Base do FGTS; se omitida, usa a mesma do INSS (a do FGTS pode incluir aviso prévio indenizado). */
  baseFgts?: number;
  tabela: TabelaAnual;
  /** Salário-família pago ao empregado — é deduzido do DAE. */
  deducaoSalarioFamilia?: number;
  /** Salário-maternidade pago pelo empregador e compensável (raro no doméstico; o INSS paga direto). */
  deducaoOutras?: number;
}

export interface ResultadoEncargos {
  inssEmpregado: number;
  inssPatronal: number;
  gilrat: number;
  fgts: number;
  fgtsCompensatorio: number;
  deducoes: number;
  totalDae: number;
  /** O que o empregador paga além do salário (sem o INSS descontado do empregado). */
  custoEmpregador: number;
  memoria: Memoria;
}

/** Encargos mensais do DAE do empregador doméstico (LC 150/2015, art. 34). */
export function calcularEncargosMensais(e: EntradaEncargos): ResultadoEncargos {
  const { tabela } = e;
  const modo = tabela.arredondamentoDae;
  const a = tabela.aliquotas;
  const baseFgts = e.baseFgts ?? e.baseInss;
  const memoria = new Memoria();

  memoria.add("Base de cálculo INSS", e.baseInss);
  if (baseFgts !== e.baseInss) memoria.add("Base de cálculo FGTS", baseFgts);

  const inss = calcularInssEmpregado(e.baseInss, tabela, modo);
  memoria.juntar(inss.memoria);

  const inssPatronal = aplicarModo((e.baseInss * a.inssPatronal) / 100, modo);
  const gilrat = aplicarModo((e.baseInss * a.gilrat) / 100, modo);
  const fgts = aplicarModo((baseFgts * a.fgts) / 100, modo);
  const fgtsCompensatorio = aplicarModo((baseFgts * a.fgtsCompensatorio) / 100, modo);

  memoria.add("INSS patronal", inssPatronal, `${formatarMoeda(e.baseInss)} × ${a.inssPatronal}%`);
  memoria.add("GILRAT (seguro acidente)", gilrat, `${formatarMoeda(e.baseInss)} × ${a.gilrat}%`);
  memoria.add("FGTS", fgts, `${formatarMoeda(baseFgts)} × ${a.fgts}%`);
  memoria.add("FGTS compensatório (indenização)", fgtsCompensatorio, `${formatarMoeda(baseFgts)} × ${a.fgtsCompensatorio}%`);

  const deducoes = somar(e.deducaoSalarioFamilia ?? 0, e.deducaoOutras ?? 0);
  if (deducoes > 0) memoria.add("(−) Deduções (salário-família etc.)", -deducoes);

  const bruto = somar(inss.valor, inssPatronal, gilrat, fgts, fgtsCompensatorio);
  const totalDae = Math.max(0, somar(bruto, -deducoes));
  const custoEmpregador = somar(inssPatronal, gilrat, fgts, fgtsCompensatorio);
  memoria.destaque("Total do DAE", totalDae, "INSS empregado + patronal + GILRAT + FGTS + FGTS compensatório − deduções");
  memoria.add("Custo do empregador (sem o INSS descontado do empregado)", custoEmpregador);
  if (modo === "truncar") memoria.nota("Parcelas truncadas no centavo, como faz o eSocial.");

  return {
    inssEmpregado: inss.valor,
    inssPatronal,
    gilrat,
    fgts,
    fgtsCompensatorio,
    deducoes,
    totalDae,
    custoEmpregador,
    memoria,
  };
}
