import { data, diaUtilAnteriorOuIgual, diferencaDias, formatarCompetencia, proximaCompetencia, soData } from "./datas";
import { arred, formatarMoeda, somar } from "./dinheiro";
import { calcularEncargosMensais } from "./encargos";
import { Memoria } from "./memoria";
import { escolherTabela, type TabelaAnual } from "./tabelas";

/** Vencimento do DAE mensal: dia 7 do mês seguinte, antecipado para o dia útil anterior. */
export function vencimentoDae(ano: number, mes: number, feriadosExtras: Date[] = []): Date {
  const prox = proximaCompetencia(ano, mes);
  return diaUtilAnteriorOuIgual(data(prox.ano, prox.mes, 7), feriadosExtras);
}

/** Vencimento do DAE do 13º: dia 20/12, antecipado para o dia útil anterior. */
export function vencimentoDaeDecimo(ano: number): Date {
  return diaUtilAnteriorOuIgual(data(ano, 12, 20));
}

/**
 * Acréscimos por atraso: multa de mora de 0,33% ao dia, limitada a 20%
 * (Lei 9.430/1996, art. 61) e juros pela taxa Selic acumulada a partir do mês
 * seguinte ao vencimento, mais 1% no mês do pagamento.
 */
export function acrescimosAtraso(
  principal: number,
  vencimento: Date,
  pagamento: Date,
  selicMensal: number,
  regras: { multaDiaria?: number; multaMaxima?: number; jurosMesPagamento?: number } = {},
) {
  const multaDiaria = regras.multaDiaria ?? 0.33;
  const multaMaxima = regras.multaMaxima ?? 20;
  const jurosMesPagamento = regras.jurosMesPagamento ?? 1;
  const dias = Math.max(0, diferencaDias(vencimento, pagamento));
  const percMulta = Math.min(multaMaxima, arred(dias * multaDiaria, 2));
  const multa = arred((principal * percMulta) / 100);
  let meses = 0;
  if (dias > 0) {
    const v = soData(vencimento);
    const p = soData(pagamento);
    meses = (p.getUTCFullYear() - v.getUTCFullYear()) * 12 + (p.getUTCMonth() - v.getUTCMonth());
  }
  // Selic acumulada dos meses entre vencimento e pagamento (exclusive) + 1% no mês do pagamento
  const percJuros = dias > 0 ? arred(Math.max(0, meses - 1) * selicMensal + jurosMesPagamento, 4) : 0;
  const juros = arred((principal * percJuros) / 100);
  return { dias, percMulta, multa, meses, percJuros, juros, total: somar(principal, multa, juros) };
}

export interface CompetenciaAtrasada {
  ano: number;
  mes: number;
  /** Remuneração do mês (base do DAE). */
  remuneracao: number;
}

export interface EntradaRegularizacao {
  competencias: CompetenciaAtrasada[];
  dataPagamento: Date;
  tabelas: TabelaAnual[] | Record<number, TabelaAnual>;
  /** Estimativa da Selic mensal em % (ex.: 1.0). Se omitida, usa o parâmetro da tabela. */
  selicMensal?: number;
  /** Regras de multa/juros vigentes na data do pagamento (da tabela de parâmetros). */
  dae?: TabelaAnual["dae"];
}

export function calcularRegularizacao(e: EntradaRegularizacao) {
  const selic = e.selicMensal ?? e.dae?.selicMensal ?? 1.0;
  const memoria = new Memoria();
  const avisos: string[] = [];
  const linhas = e.competencias
    .slice()
    .sort((a, b) => a.ano * 100 + a.mes - (b.ano * 100 + b.mes))
    .map((c) => {
      const { tabela, aproximada } = escolherTabela(e.tabelas, c.ano);
      if (aproximada) avisos.push(`Sem tabela de ${c.ano}; usada a de ${tabela.ano}.`);
      const enc = calcularEncargosMensais({ baseInss: c.remuneracao, tabela });
      const venc = vencimentoDae(c.ano, c.mes);
      const acr = acrescimosAtraso(enc.totalDae, venc, e.dataPagamento, selic, e.dae ?? {});
      memoria.add(
        `${formatarCompetencia(c.ano, c.mes)}: DAE ${formatarMoeda(enc.totalDae)}`,
        acr.total,
        `${acr.dias} dias de atraso → multa ${acr.percMulta}% (${formatarMoeda(acr.multa)}) + juros ${acr.percJuros}% (${formatarMoeda(acr.juros)})`,
      );
      return {
        competencia: formatarCompetencia(c.ano, c.mes),
        ano: c.ano,
        mes: c.mes,
        remuneracao: c.remuneracao,
        principal: enc.totalDae,
        fgts: somar(enc.fgts, enc.fgtsCompensatorio),
        inss: somar(enc.inssEmpregado, enc.inssPatronal, enc.gilrat),
        vencimento: venc,
        ...acr,
      };
    });

  const totais = {
    principal: somar(...linhas.map((l) => l.principal)),
    multa: somar(...linhas.map((l) => l.multa)),
    juros: somar(...linhas.map((l) => l.juros)),
    total: somar(...linhas.map((l) => l.total)),
  };
  memoria.destaque("Total estimado para regularizar", totais.total);
  memoria.nota(`Juros estimados com Selic de ${selic}% ao mês. O valor oficial é calculado pelo eSocial na emissão do DAE.`);
  memoria.nota("Em atrasos longos, verifique também a necessidade de enviar os eventos de folha retroativos e o risco de multas trabalhistas.");
  return { linhas, totais, avisos: [...new Set(avisos)], memoria };
}

/** Gera a lista de competências entre duas datas (inclusive), com a mesma remuneração. */
export function competenciasEntre(inicio: Date, fim: Date, remuneracao: number): CompetenciaAtrasada[] {
  const lista: CompetenciaAtrasada[] = [];
  let ano = inicio.getUTCFullYear();
  let mes = inicio.getUTCMonth() + 1;
  const limite = fim.getUTCFullYear() * 100 + fim.getUTCMonth() + 1;
  while (ano * 100 + mes <= limite) {
    lista.push({ ano, mes, remuneracao });
    ({ ano, mes } = proximaCompetencia(ano, mes));
  }
  return lista;
}
