import { calcularSalarioFamilia, calcularValeTransporte } from "./beneficios";
import { diasUteisEDescansoNoMes, formatarData } from "./datas";
import { arred, formatarMoeda, somar } from "./dinheiro";
import { calcularEncargosMensais, type ResultadoEncargos } from "./encargos";
import { Memoria } from "./memoria";
import {
  descontoAtrasos,
  descontoFaltas,
  periodoTrabalhadoNoMes,
  reflexoDsr,
  salarioProporcional,
  valorAdicionalNoturno,
  valorHora,
  valorHorasExtras,
} from "./salario";
import type { TabelaAnual } from "./tabelas";

export interface EntradaFolha {
  ano: number;
  mes: number;
  salario: number;
  horasSemanais: number;
  admissao: Date;
  desligamento?: Date | null;
  tabela: TabelaAnual;
  faltasInjustificadas?: number;
  semanasComFalta?: number;
  atrasoMinutos?: number;
  horasExtras50?: number;
  horasExtras100?: number;
  /** Horas noturnas já convertidas (hora noturna reduzida). */
  horasNoturnas?: number;
  /** Horas em viagem de acompanhamento (adicional de 25%, LC 150 art. 11). */
  horasViagem?: number;
  /** Intervalo não concedido, em horas (pago com 50%, natureza indenizatória). */
  horasIntervaloSuprimido?: number;
  adiantamento?: number;
  dependentesSalarioFamilia?: number;
  custoValeTransporte?: number;
  outrosProventos?: number;
  outrosDescontos?: number;
  /** Calcular reflexo do DSR sobre horas extras e adicional noturno (padrão: sim). */
  reflexoDsr?: boolean;
}

export interface ItemFolha {
  descricao: string;
  valor: number;
  formula?: string;
  incideInss: boolean;
  incideFgts: boolean;
  /** Nome da rubrica a lançar no eSocial Doméstico. */
  rubrica?: string;
}

export interface ResultadoFolha {
  diasTrabalhados: number;
  diasMes: number;
  proventos: ItemFolha[];
  descontos: ItemFolha[];
  baseInss: number;
  baseFgts: number;
  totalProventos: number;
  totalDescontos: number;
  liquido: number;
  salarioFamilia: number;
  encargos: ResultadoEncargos;
  memoria: Memoria;
}

/** Folha mensal completa do empregado doméstico, com DAE e memória de cálculo. */
export function calcularFolhaMensal(e: EntradaFolha): ResultadoFolha {
  const memoria = new Memoria();
  const periodo = periodoTrabalhadoNoMes(e.ano, e.mes, e.admissao, e.desligamento);
  const proventos: ItemFolha[] = [];
  const descontos: ItemFolha[] = [];

  if (periodo.dias === 0) {
    memoria.nota("Sem vínculo no mês informado.");
  }

  const sal = salarioProporcional(e.salario, periodo.dias, periodo.diasMes);
  if (!periodo.mesCompleto && periodo.dias > 0) {
    memoria.nota(`Mês incompleto: de ${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)} (${periodo.dias} dias).`);
  }
  proventos.push({
    descricao: periodo.mesCompleto ? "Salário" : `Salário proporcional (${periodo.dias} dias)`,
    valor: sal.valor,
    formula: periodo.mesCompleto ? undefined : sal.formula,
    incideInss: true,
    incideFgts: true,
    rubrica: "Salário",
  });

  const vh = valorHora(e.salario, e.horasSemanais);
  memoria.add("Valor da hora", arred(vh, 4), `${formatarMoeda(e.salario)} ÷ ${arred(e.horasSemanais * 5)} h mensais`);

  let variaveis = 0;
  if (e.horasExtras50) {
    const he = valorHorasExtras(e.salario, e.horasSemanais, e.horasExtras50, 50);
    proventos.push({ descricao: `Horas extras 50% (${e.horasExtras50} h)`, valor: he.valor, formula: he.formula, incideInss: true, incideFgts: true, rubrica: "Horas extras" });
    variaveis += he.valor;
  }
  if (e.horasExtras100) {
    const he = valorHorasExtras(e.salario, e.horasSemanais, e.horasExtras100, 100);
    proventos.push({ descricao: `Horas extras 100% (${e.horasExtras100} h)`, valor: he.valor, formula: he.formula, incideInss: true, incideFgts: true, rubrica: "Horas extras 100%" });
    variaveis += he.valor;
  }
  if (e.horasNoturnas) {
    const an = valorAdicionalNoturno(e.salario, e.horasSemanais, e.horasNoturnas, 20);
    proventos.push({ descricao: `Adicional noturno 20% (${e.horasNoturnas} h)`, valor: an.valor, formula: an.formula, incideInss: true, incideFgts: true, rubrica: "Adicional noturno" });
    variaveis += an.valor;
  }
  if (e.horasViagem) {
    const v = arred(vh * 0.25 * e.horasViagem);
    proventos.push({ descricao: `Adicional de viagem 25% (${e.horasViagem} h)`, valor: v, formula: `${formatarMoeda(arred(vh, 4))}/h × 25% × ${e.horasViagem} h`, incideInss: true, incideFgts: true, rubrica: "Adicional de viagem" });
    variaveis += v;
  }
  if (variaveis > 0 && e.reflexoDsr !== false) {
    const { uteis, descanso } = diasUteisEDescansoNoMes(e.ano, e.mes);
    const r = reflexoDsr(variaveis, uteis, descanso);
    proventos.push({ descricao: "DSR sobre horas extras/adicionais", valor: r.valor, formula: r.formula, incideInss: true, incideFgts: true, rubrica: "DSR sobre variáveis" });
  }
  if (e.horasIntervaloSuprimido) {
    const v = arred(vh * 1.5 * e.horasIntervaloSuprimido);
    proventos.push({ descricao: `Intervalo não concedido (${e.horasIntervaloSuprimido} h + 50%)`, valor: v, formula: `${formatarMoeda(arred(vh, 4))}/h × 1,5 × ${e.horasIntervaloSuprimido} h (indenizatório)`, incideInss: false, incideFgts: false, rubrica: "Intervalo intrajornada não concedido" });
  }
  if (e.outrosProventos) {
    proventos.push({ descricao: "Outros proventos", valor: arred(e.outrosProventos), incideInss: true, incideFgts: true });
  }

  if (e.faltasInjustificadas || e.semanasComFalta) {
    const f = descontoFaltas(e.salario, e.faltasInjustificadas ?? 0, e.semanasComFalta ?? 0);
    if (f.faltas) descontos.push({ descricao: `Faltas injustificadas (${e.faltasInjustificadas} dia(s))`, valor: f.faltas, formula: f.memoria.linhas[0]?.formula, incideInss: true, incideFgts: true, rubrica: "Faltas" });
    if (f.dsr) descontos.push({ descricao: `DSR perdido (${e.semanasComFalta} semana(s))`, valor: f.dsr, formula: f.memoria.linhas.at(-1)?.formula, incideInss: true, incideFgts: true, rubrica: "DSR - desconto" });
  }
  if (e.atrasoMinutos) {
    const a = descontoAtrasos(e.salario, e.horasSemanais, e.atrasoMinutos);
    descontos.push({ descricao: `Atrasos (${e.atrasoMinutos} min)`, valor: a.valor, formula: a.formula, incideInss: true, incideFgts: true, rubrica: "Atrasos" });
  }

  const somaIncide = (lista: ItemFolha[], campo: "incideInss" | "incideFgts") =>
    somar(...lista.filter((i) => i[campo]).map((i) => i.valor));
  const baseInss = Math.max(0, somar(somaIncide(proventos, "incideInss"), -somaIncide(descontos, "incideInss")));
  const baseFgts = Math.max(0, somar(somaIncide(proventos, "incideFgts"), -somaIncide(descontos, "incideFgts")));

  const sf = calcularSalarioFamilia(baseInss, e.dependentesSalarioFamilia ?? 0, e.tabela, periodo.mesCompleto ? 1 : periodo.dias / periodo.diasMes);
  if (sf.valor > 0) {
    proventos.push({ descricao: "Salário-família", valor: sf.valor, formula: sf.motivo, incideInss: false, incideFgts: false, rubrica: "Salário-família" });
  }

  const encargos = calcularEncargosMensais({ baseInss, baseFgts, tabela: e.tabela, deducaoSalarioFamilia: sf.valor });
  descontos.push({ descricao: "INSS", valor: encargos.inssEmpregado, formula: "tabela progressiva", incideInss: false, incideFgts: false, rubrica: "Contribuição previdenciária" });

  if (e.custoValeTransporte) {
    const vt = calcularValeTransporte(e.salario, e.custoValeTransporte);
    if (vt.descontoEmpregado > 0) descontos.push({ descricao: "Vale-transporte (até 6%)", valor: vt.descontoEmpregado, formula: vt.formula, incideInss: false, incideFgts: false, rubrica: "Vale-transporte - desconto" });
  }
  if (e.adiantamento) {
    descontos.push({ descricao: "Adiantamento salarial", valor: arred(e.adiantamento), incideInss: false, incideFgts: false, rubrica: "Adiantamento" });
  }
  if (e.outrosDescontos) {
    descontos.push({ descricao: "Outros descontos", valor: arred(e.outrosDescontos), incideInss: false, incideFgts: false });
  }

  const totalProventos = somar(...proventos.map((p) => p.valor));
  const totalDescontos = somar(...descontos.map((d) => d.valor));
  const liquido = somar(totalProventos, -totalDescontos);

  for (const p of proventos) memoria.add(`(+) ${p.descricao}`, p.valor, p.formula);
  for (const d of descontos) memoria.add(`(−) ${d.descricao}`, -d.valor, d.formula);
  memoria.destaque("Líquido a pagar ao empregado", liquido);
  memoria.juntar(encargos.memoria, "DAE");

  return {
    diasTrabalhados: periodo.dias,
    diasMes: periodo.diasMes,
    proventos,
    descontos,
    baseInss,
    baseFgts,
    totalProventos,
    totalDescontos,
    liquido,
    salarioFamilia: sf.valor,
    encargos,
    memoria,
  };
}
