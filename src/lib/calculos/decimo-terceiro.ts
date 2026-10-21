import { data, diaUtilAnteriorOuIgual, formatarData, nomeMes } from "./datas";
import { aplicarModo, arred, formatarMoeda, somar } from "./dinheiro";
import { calcularInssEmpregado } from "./inss";
import { Memoria } from "./memoria";
import { periodoTrabalhadoNoMes } from "./salario";
import type { TabelaAnual } from "./tabelas";

/**
 * Avos de 13º no ano: cada mês com 15 dias ou mais de trabalho conta 1/12.
 * `ate` permite contar só até certo mês (ex.: novembro para a 1ª parcela)
 * ou até a data projetada do aviso prévio na rescisão.
 */
export function avosDecimoTerceiro(
  ano: number,
  admissao: Date,
  fim?: Date | null,
  opcoes: { ateMes?: number; mesesExcluidos?: number[] } = {},
) {
  const ateMes = opcoes.ateMes ?? 12;
  const detalhes: { mes: number; dias: number; conta: boolean }[] = [];
  for (let mes = 1; mes <= ateMes; mes++) {
    const p = periodoTrabalhadoNoMes(ano, mes, admissao, fim);
    const excluido = opcoes.mesesExcluidos?.includes(mes) ?? false;
    detalhes.push({ mes, dias: p.dias, conta: p.dias >= 15 && !excluido });
  }
  return { avos: detalhes.filter((d) => d.conta).length, detalhes };
}

export interface EntradaDecimoTerceiro {
  ano: number;
  salario: number;
  admissao: Date;
  desligamento?: Date | null;
  /** Média de horas extras/adicionais habituais do ano, somada à remuneração. */
  mediaVariaveis?: number;
  /** Valor já pago na 1ª parcela (se omitido, usa o calculado). */
  primeiraParcelaPaga?: number;
  /** Meses sem direito (ex.: afastamento por auxílio-doença acima de 15 dias pago pelo INSS). */
  mesesExcluidos?: number[];
  tabela: TabelaAnual;
}

export function calcularDecimoTerceiro(e: EntradaDecimoTerceiro) {
  const memoria = new Memoria();
  const remuneracao = somar(e.salario, e.mediaVariaveis ?? 0);
  const modo = e.tabela.arredondamentoDae;

  const avosNov = avosDecimoTerceiro(e.ano, e.admissao, e.desligamento, { ateMes: 11, mesesExcluidos: e.mesesExcluidos });
  const avosAno = avosDecimoTerceiro(e.ano, e.admissao, e.desligamento, { mesesExcluidos: e.mesesExcluidos });

  memoria.add("Remuneração considerada", remuneracao, e.mediaVariaveis ? `salário + média de variáveis (${formatarMoeda(e.mediaVariaveis)})` : undefined);
  memoria.add("Avos até novembro", avosNov.avos, "meses com 15 dias ou mais trabalhados", "numero");
  memoria.add("Avos no ano", avosAno.avos, undefined, "numero");

  const total = arred((remuneracao / 12) * avosAno.avos);
  memoria.add("13º integral do ano", total, `${formatarMoeda(remuneracao)} ÷ 12 × ${avosAno.avos}`);

  // Lei 4.749/1965, art. 2º: metade do salário (proporcional aos avos do ano para quem foi admitido no ano)
  const primeiraCalculada = arred(total / 2);
  const primeira = e.primeiraParcelaPaga ?? primeiraCalculada;
  memoria.add("1ª parcela (adiantamento, sem INSS)", primeira, e.primeiraParcelaPaga !== undefined ? "valor informado como já pago" : `${formatarMoeda(total)} ÷ 2`);

  const inss = calcularInssEmpregado(total, e.tabela);
  memoria.add("INSS sobre o 13º (tabela própria, separado do mês)", inss.valor);

  const segunda = somar(total, -primeira, -inss.valor);
  memoria.destaque("2ª parcela líquida", segunda, "13º integral − 1ª parcela − INSS");

  const a = e.tabela.aliquotas;
  const inssPatronal = aplicarModo((total * a.inssPatronal) / 100, modo);
  const gilrat = aplicarModo((total * a.gilrat) / 100, modo);
  const daeDecimo = somar(inss.valor, inssPatronal, gilrat);
  memoria.add("DAE do 13º: INSS empregado", inss.valor);
  memoria.add("DAE do 13º: INSS patronal", inssPatronal, `${formatarMoeda(total)} × ${a.inssPatronal}%`);
  memoria.add("DAE do 13º: GILRAT", gilrat, `${formatarMoeda(total)} × ${a.gilrat}%`);
  memoria.destaque("DAE do 13º (vence 20/12)", daeDecimo);

  const taxaFgts = a.fgts + a.fgtsCompensatorio;
  const fgtsPrimeira = aplicarModo((primeira * a.fgts) / 100, modo) + aplicarModo((primeira * a.fgtsCompensatorio) / 100, modo);
  const baseFgtsSegunda = somar(total, -primeira);
  const fgtsSegunda = aplicarModo((baseFgtsSegunda * a.fgts) / 100, modo) + aplicarModo((baseFgtsSegunda * a.fgtsCompensatorio) / 100, modo);
  memoria.add(`FGTS (${taxaFgts}%) da 1ª parcela — entra no DAE de novembro`, arred(fgtsPrimeira));
  memoria.add(`FGTS (${taxaFgts}%) da 2ª parcela — entra no DAE de dezembro`, arred(fgtsSegunda));

  const prazoPrimeira = diaUtilAnteriorOuIgual(data(e.ano, 11, 30));
  const prazoSegunda = diaUtilAnteriorOuIgual(data(e.ano, 12, 20));
  memoria.nota(`Prazos: 1ª parcela até ${formatarData(prazoPrimeira)}; 2ª parcela e DAE do 13º até ${formatarData(prazoSegunda)}.`);
  memoria.nota("A 1ª parcela pode ser paga nas férias se o empregado pedir em janeiro.");

  return {
    remuneracao,
    avosNovembro: avosNov.avos,
    avos: avosAno.avos,
    detalhesAvos: avosAno.detalhes.map((d) => ({ ...d, nomeMes: nomeMes(d.mes) })),
    primeiraParcela: primeira,
    total,
    inss: inss.valor,
    segundaParcela: segunda,
    dae: { inssEmpregado: inss.valor, inssPatronal, gilrat, total: daeDecimo, vencimento: prazoSegunda },
    fgtsPrimeira: arred(fgtsPrimeira),
    fgtsSegunda: arred(fgtsSegunda),
    prazoPrimeira,
    prazoSegunda,
    memoria,
  };
}
