import { calcularValeTransporte } from "./beneficios";
import { arred, formatarMoeda, somar } from "./dinheiro";
import { calcularEncargosMensais } from "./encargos";
import { Memoria } from "./memoria";
import { salarioMinimoProporcional, valorHora } from "./salario";
import type { TabelaAnual } from "./tabelas";

function taxaPatronal(t: TabelaAnual) {
  const a = t.aliquotas;
  return a.inssPatronal + a.gilrat + a.fgts + a.fgtsCompensatorio;
}

export interface EntradaCusto {
  salario: number;
  horasSemanais: number;
  /** Custo mensal das passagens de vale-transporte. */
  custoValeTransporte?: number;
  tabela: TabelaAnual;
}

/** Custo total de contratar: salário, DAE, 13º, férias + 1/3, provisão de rescisão e vale-transporte. */
export function simularCustoContratacao(e: EntradaCusto) {
  const memoria = new Memoria();
  const taxa = taxaPatronal(e.tabela);
  const enc = calcularEncargosMensais({ baseInss: e.salario, tabela: e.tabela });
  const vt = e.custoValeTransporte ? calcularValeTransporte(e.salario, e.custoValeTransporte) : null;

  const provisao13 = arred(e.salario / 12);
  const provisaoFerias = arred((e.salario * (4 / 3)) / 12);
  const encargosProvisoes = arred(((provisao13 + provisaoFerias) * taxa) / 100);
  const provisaoRescisao = arred(e.salario / 12);
  const vtMensal = vt ? arred((vt.custoEmpregador * 11) / 12) : 0;

  const mensal = {
    salario: e.salario,
    encargos: enc.custoEmpregador,
    provisao13,
    provisaoFerias,
    encargosProvisoes,
    provisaoRescisao,
    valeTransporte: vtMensal,
    total: somar(e.salario, enc.custoEmpregador, provisao13, provisaoFerias, encargosProvisoes, provisaoRescisao, vtMensal),
  };
  const anual = {
    salarios: arred(e.salario * 12),
    decimoTerceiro: e.salario,
    ferias: arred(e.salario * (4 / 3)),
    encargos: arred(((e.salario * 12 + e.salario + e.salario * (4 / 3)) * taxa) / 100),
    valeTransporte: vt ? arred(vt.custoEmpregador * 11) : 0,
    provisaoRescisao: e.salario,
    total: 0,
  };
  anual.total = somar(anual.salarios, anual.decimoTerceiro, anual.ferias, anual.encargos, anual.valeTransporte, anual.provisaoRescisao);

  memoria.add("Salário mensal", e.salario);
  memoria.add(`Encargos do empregador no DAE (${taxa}%)`, enc.custoEmpregador, "INSS 8% + GILRAT 0,8% + FGTS 8% + FGTS compensatório 3,2%");
  memoria.add("Provisão de 13º", provisao13, "salário ÷ 12");
  memoria.add("Provisão de férias + 1/3", provisaoFerias, "salário × 4/3 ÷ 12");
  memoria.add("Encargos sobre as provisões", encargosProvisoes, `(13º + férias) × ${taxa}%`);
  memoria.add("Provisão para aviso prévio em eventual rescisão", provisaoRescisao, "salário ÷ 12 (estimativa)");
  if (vt) memoria.add("Vale-transporte (parte do empregador)", vtMensal, `${vt.formula}; 11 meses ÷ 12`);
  memoria.destaque("Custo mensal médio", mensal.total);
  memoria.destaque("Custo anual estimado", anual.total);
  memoria.add("INSS descontado do empregado (não é custo do empregador)", enc.inssEmpregado);

  return { mensal, anual, dae: enc.totalDae, inssEmpregado: enc.inssEmpregado, memoria };
}

/** Provisão mensal automática: quanto guardar por mês para 13º, férias e uma eventual rescisão. */
export function provisaoMensal(salario: number, tabela: TabelaAnual) {
  const c = simularCustoContratacao({ salario, horasSemanais: 44, tabela });
  const { provisao13, provisaoFerias, encargosProvisoes, provisaoRescisao } = c.mensal;
  return {
    decimoTerceiro: provisao13,
    ferias: provisaoFerias,
    encargos: encargosProvisoes,
    rescisao: provisaoRescisao,
    total: somar(provisao13, provisaoFerias, encargosProvisoes, provisaoRescisao),
  };
}

export interface EntradaComparador {
  tabela: TabelaAnual;
  diarista: { valorDiaria: number; diasPorSemana: number };
  parcial: { salario: number; horasSemanais: number };
  integral: { salario: number };
}

/** Comparador: diarista x mensalista parcial x mensalista integral. */
export function compararModelos(e: EntradaComparador) {
  const semanasMes = 52 / 12;
  const diaristaMensal = arred(e.diarista.valorDiaria * e.diarista.diasPorSemana * semanasMes);
  const minParcial = salarioMinimoProporcional(e.tabela.salarioMinimo, e.parcial.horasSemanais);
  const parcial = simularCustoContratacao({ salario: Math.max(e.parcial.salario, minParcial), horasSemanais: e.parcial.horasSemanais, tabela: e.tabela });
  const integral = simularCustoContratacao({ salario: Math.max(e.integral.salario, e.tabela.salarioMinimo), horasSemanais: 44, tabela: e.tabela });

  return [
    {
      modelo: "Diarista",
      descricao: `${e.diarista.diasPorSemana} dia(s) por semana a ${formatarMoeda(e.diarista.valorDiaria)}`,
      custoMensal: diaristaMensal,
      custoAnual: arred(diaristaMensal * 12),
      obrigacoes: [
        "Sem vínculo de emprego se trabalhar até 2 dias por semana.",
        "Sem DAE, férias, 13º ou FGTS.",
        "A diarista recolhe o próprio INSS (contribuinte individual ou MEI, quando permitido).",
        "Risco: 3 dias ou mais por semana caracteriza vínculo e gera dívida retroativa.",
      ],
      alerta: e.diarista.diasPorSemana > 2 ? "Com mais de 2 dias por semana há vínculo empregatício!" : null,
    },
    {
      modelo: "Mensalista parcial",
      descricao: `${e.parcial.horasSemanais}h semanais, salário ${formatarMoeda(Math.max(e.parcial.salario, minParcial))}`,
      custoMensal: parcial.mensal.total,
      custoAnual: parcial.anual.total,
      obrigacoes: [
        "Registro no eSocial e DAE mensal até o dia 7.",
        "Jornada até 25h semanais e 6h diárias; hora extra de no máximo 1h/dia com acordo escrito.",
        "Férias, 13º, FGTS e controle de ponto.",
      ],
      alerta: e.parcial.salario < minParcial ? `Salário ajustado ao mínimo proporcional de ${formatarMoeda(minParcial)}.` : null,
    },
    {
      modelo: "Mensalista integral",
      descricao: `44h semanais, salário ${formatarMoeda(Math.max(e.integral.salario, e.tabela.salarioMinimo))}`,
      custoMensal: integral.mensal.total,
      custoAnual: integral.anual.total,
      obrigacoes: [
        "Registro no eSocial e DAE mensal até o dia 7.",
        "Jornada até 8h diárias e 44h semanais; controle de ponto obrigatório.",
        "Férias de 30 dias + 1/3, 13º, FGTS, vale-transporte se solicitado.",
      ],
      alerta: e.integral.salario < e.tabela.salarioMinimo ? "Salário ajustado ao salário mínimo." : null,
    },
  ];
}

/** Impacto de um reajuste (ou do novo salário mínimo) no custo mensal e anual. */
export function simularReajuste(e: { salarioAtual: number; salarioNovo: number; horasSemanais: number; tabelaAtual: TabelaAnual; tabelaNova?: TabelaAnual }) {
  const atual = simularCustoContratacao({ salario: e.salarioAtual, horasSemanais: e.horasSemanais, tabela: e.tabelaAtual });
  const novo = simularCustoContratacao({ salario: e.salarioNovo, horasSemanais: e.horasSemanais, tabela: e.tabelaNova ?? e.tabelaAtual });
  const minimoNovo = salarioMinimoProporcional((e.tabelaNova ?? e.tabelaAtual).salarioMinimo, e.horasSemanais);
  return {
    atual,
    novo,
    diferencaMensal: somar(novo.mensal.total, -atual.mensal.total),
    diferencaAnual: somar(novo.anual.total, -atual.anual.total),
    percentual: e.salarioAtual > 0 ? arred(((e.salarioNovo - e.salarioAtual) / e.salarioAtual) * 100, 2) : 0,
    minimoProporcionalNovo: minimoNovo,
    abaixoDoMinimo: e.salarioNovo < minimoNovo,
  };
}

/** Quanto custa pedir horas a mais (extras e/ou noturnas) em um dia. */
export function simularHoraExtra(e: {
  salario: number;
  horasSemanais: number;
  horasExtras: number;
  domingoOuFeriado?: boolean;
  /** Horas reais entre 22h e 5h (o sistema converte para hora noturna reduzida). */
  horasNoturnasReais?: number;
  tabela: TabelaAnual;
}) {
  const memoria = new Memoria();
  const vh = valorHora(e.salario, e.horasSemanais);
  const adicional = e.domingoOuFeriado ? 100 : 50;
  const extras = arred(vh * (1 + adicional / 100) * e.horasExtras);
  const noturnasConvertidas = arred(((e.horasNoturnasReais ?? 0) * 60) / 52.5, 2);
  const noturno = arred(vh * 0.2 * noturnasConvertidas);
  const taxa = taxaPatronal(e.tabela);
  const encargos = arred(((extras + noturno) * taxa) / 100);
  const reflexos = arred(((extras + noturno) * (1 / 12 + 4 / 3 / 12)));
  memoria.add("Valor da hora normal", arred(vh, 2), `${formatarMoeda(e.salario)} ÷ ${e.horasSemanais * 5} h`);
  memoria.add(`Horas extras ${adicional}%`, extras, `${formatarMoeda(arred(vh, 4))} × ${1 + adicional / 100} × ${e.horasExtras} h`);
  if (noturno) memoria.add("Adicional noturno 20%", noturno, `${e.horasNoturnasReais} h reais = ${noturnasConvertidas} h noturnas (52min30s)`);
  memoria.add(`Encargos do empregador (${taxa}%)`, encargos);
  memoria.add("Reflexos em 13º e férias + 1/3 (provisão)", reflexos);
  const total = somar(extras, noturno, encargos, reflexos);
  memoria.destaque("Custo total estimado", total);
  if (e.horasExtras > 2) memoria.nota("Atenção: o limite legal é de 2 horas extras por dia (1h no tempo parcial).");
  return { valorHora: arred(vh, 2), extras, noturno, encargos, reflexos, total, memoria };
}
