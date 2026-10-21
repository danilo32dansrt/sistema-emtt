import { avosDecimoTerceiro } from "./decimo-terceiro";
import { addDias, anosCompletos, diferencaDias, formatarData, soData } from "./datas";
import { aplicarModo, arred, formatarMoeda, somar } from "./dinheiro";
import { avosFerias, periodosFerias, type FeriasGozadas } from "./ferias";
import { calcularInssEmpregado } from "./inss";
import { Memoria } from "./memoria";
import { periodoTrabalhadoNoMes, salarioProporcional, valorHora } from "./salario";
import type { TabelaAnual } from "./tabelas";

export type TipoRescisao =
  | "SEM_JUSTA_CAUSA"
  | "PEDIDO_DEMISSAO"
  | "JUSTA_CAUSA"
  | "TERMINO_CONTRATO"
  | "ACORDO"
  | "FALECIMENTO"
  | "ANTECIPADA_EXPERIENCIA_EMPREGADOR"
  | "ANTECIPADA_EXPERIENCIA_EMPREGADO";

export const NOMES_RESCISAO: Record<TipoRescisao, string> = {
  SEM_JUSTA_CAUSA: "Dispensa sem justa causa",
  PEDIDO_DEMISSAO: "Pedido de demissão",
  JUSTA_CAUSA: "Dispensa por justa causa",
  TERMINO_CONTRATO: "Término do contrato (experiência/prazo determinado)",
  ACORDO: "Acordo entre as partes (art. 484-A da CLT)",
  FALECIMENTO: "Falecimento do empregado",
  ANTECIPADA_EXPERIENCIA_EMPREGADOR: "Experiência encerrada antes do prazo pelo empregador",
  ANTECIPADA_EXPERIENCIA_EMPREGADO: "Experiência encerrada antes do prazo pelo empregado",
};

export type ModoAviso = "INDENIZADO" | "TRABALHADO" | "NAO_CUMPRIDO" | "DISPENSADO";

export interface EntradaRescisao {
  tipo: TipoRescisao;
  admissao: Date;
  /** Último dia trabalhado (ou data do óbito). */
  desligamento: Date;
  salario: number;
  horasSemanais: number;
  tabela: TabelaAnual;
  /** Média de horas extras/adicionais habituais. */
  mediaVariaveis?: number;
  avisoPrevio?: ModoAviso;
  feriasGozadas?: FeriasGozadas[];
  diasDireitoFerias?: number;
  primeiraParcela13Paga?: number;
  saldoBancoHoras?: number;
  /** Saldo do FGTS 8% depositado (para mostrar quanto pode sacar). */
  saldoFgts?: number;
  /** FGTS compensatório (3,2%) acumulado; se omitido, é estimado. */
  fgtsCompensatorioAcumulado?: number;
  /** Fim previsto do contrato de experiência. */
  fimExperiencia?: Date;
  /** Estabilidade (gestante ou acidente de trabalho) vigente. */
  estabilidade?: { motivo: string; ate: Date } | null;
  /** Dias já descontados/pagos de outros débitos (adiantamentos etc.). */
  outrosDescontos?: number;
}

export interface VerbaRescisoria {
  descricao: string;
  valor: number;
  natureza: "provento" | "desconto";
  incideInss: boolean;
  incideFgts: boolean;
  formula?: string;
}

const SEM_AVISO: TipoRescisao[] = ["JUSTA_CAUSA", "TERMINO_CONTRATO", "FALECIMENTO", "ANTECIPADA_EXPERIENCIA_EMPREGADOR", "ANTECIPADA_EXPERIENCIA_EMPREGADO"];

/** Aviso prévio proporcional (Lei 12.506/2011): 30 dias + 3 por ano completo, até 90. */
export function diasAvisoPrevio(admissao: Date, desligamento: Date): number {
  const anos = anosCompletos(admissao, desligamento);
  return Math.min(90, 30 + 3 * Math.min(anos, 20));
}

export function calcularRescisao(e: EntradaRescisao) {
  const memoria = new Memoria();
  const alertas: string[] = [];
  const verbas: VerbaRescisoria[] = [];
  const desl = soData(e.desligamento);
  const remuneracao = somar(e.salario, e.mediaVariaveis ?? 0);
  const diaRem = remuneracao / 30;
  const diasDireito = e.diasDireitoFerias ?? 30;

  let bloqueio: string | null = null;
  if (e.estabilidade && e.estabilidade.ate.getTime() >= desl.getTime() &&
      ["SEM_JUSTA_CAUSA", "ANTECIPADA_EXPERIENCIA_EMPREGADOR", "TERMINO_CONTRATO"].includes(e.tipo)) {
    bloqueio = `Empregado com estabilidade (${e.estabilidade.motivo}) até ${formatarData(e.estabilidade.ate)}. A dispensa sem justa causa não é permitida neste período — procure orientação jurídica.`;
  }

  memoria.add("Tipo de desligamento", undefined, NOMES_RESCISAO[e.tipo], "texto");
  memoria.add("Remuneração base", remuneracao);

  // Aviso prévio e projeção
  const diasAviso = SEM_AVISO.includes(e.tipo) ? 0 : e.tipo === "PEDIDO_DEMISSAO" ? 30 : diasAvisoPrevio(e.admissao, desl);
  const modoAviso: ModoAviso = e.avisoPrevio ?? (e.tipo === "PEDIDO_DEMISSAO" ? "TRABALHADO" : "INDENIZADO");
  let diasIndenizados = 0;
  if (e.tipo === "SEM_JUSTA_CAUSA") diasIndenizados = modoAviso === "TRABALHADO" ? diasAviso - 30 : diasAviso;
  if (e.tipo === "ACORDO") diasIndenizados = modoAviso === "TRABALHADO" ? Math.max(0, diasAviso - 30) : diasAviso;
  const dataProjetada = addDias(desl, diasIndenizados);
  if (diasAviso) {
    memoria.add("Dias de aviso prévio", diasAviso, e.tipo === "PEDIDO_DEMISSAO" ? "pedido de demissão: 30 dias" : "30 + 3 por ano completo (máx. 90)", "dias");
  }
  if (diasIndenizados) {
    memoria.add("Data projetada pelo aviso indenizado", undefined, formatarData(dataProjetada), "texto");
  }

  // Saldo de salário
  const p = periodoTrabalhadoNoMes(desl.getUTCFullYear(), desl.getUTCMonth() + 1, e.admissao, desl);
  const saldo = salarioProporcional(e.salario, p.dias, p.diasMes);
  verbas.push({ descricao: `Saldo de salário (${p.dias} dias)`, valor: saldo.valor, natureza: "provento", incideInss: true, incideFgts: true, formula: saldo.formula });

  // Aviso prévio
  if (diasIndenizados > 0) {
    const fracao = e.tipo === "ACORDO" ? 0.5 : 1;
    const valor = arred(diaRem * diasIndenizados * fracao);
    verbas.push({
      descricao: `Aviso prévio indenizado (${diasIndenizados} dias${fracao < 1 ? ", metade por acordo" : ""})`,
      valor,
      natureza: "provento",
      incideInss: false,
      incideFgts: true,
      formula: `${formatarMoeda(arred(diaRem, 4))}/dia × ${diasIndenizados}${fracao < 1 ? " × 50%" : ""}`,
    });
  }
  if (e.tipo === "PEDIDO_DEMISSAO" && modoAviso === "NAO_CUMPRIDO") {
    verbas.push({ descricao: "Desconto do aviso prévio não cumprido (30 dias)", valor: arred(remuneracao), natureza: "desconto", incideInss: false, incideFgts: false, formula: "CLT art. 487, § 2º" });
  }

  // Contrato de experiência encerrado antes do prazo (CLT arts. 479 e 480)
  if ((e.tipo === "ANTECIPADA_EXPERIENCIA_EMPREGADOR" || e.tipo === "ANTECIPADA_EXPERIENCIA_EMPREGADO") && e.fimExperiencia) {
    const restantes = Math.max(0, diferencaDias(desl, e.fimExperiencia));
    const valor = arred((diaRem * restantes) / 2);
    if (e.tipo === "ANTECIPADA_EXPERIENCIA_EMPREGADOR") {
      verbas.push({ descricao: `Indenização art. 479 CLT (metade de ${restantes} dias restantes)`, valor, natureza: "provento", incideInss: false, incideFgts: false });
    } else {
      verbas.push({ descricao: `Indenização art. 480 CLT (até metade de ${restantes} dias restantes)`, valor, natureza: "desconto", incideInss: false, incideFgts: false });
      alertas.push("O desconto do art. 480 depende de prejuízo comprovado ao empregador; revise antes de aplicar.");
    }
  }

  // 13º proporcional
  if (e.tipo !== "JUSTA_CAUSA") {
    let avos = 0;
    for (let ano = desl.getUTCFullYear(); ano <= dataProjetada.getUTCFullYear(); ano++) {
      avos += avosDecimoTerceiro(ano, e.admissao, dataProjetada).avos;
    }
    const valor13 = arred((remuneracao / 12) * avos);
    verbas.push({ descricao: `13º salário proporcional (${avos}/12)`, valor: valor13, natureza: "provento", incideInss: true, incideFgts: true, formula: `${formatarMoeda(remuneracao)} ÷ 12 × ${avos}` });
    if (e.primeiraParcela13Paga) {
      verbas.push({ descricao: "Desconto da 1ª parcela do 13º já paga", valor: arred(e.primeiraParcela13Paga), natureza: "desconto", incideInss: false, incideFgts: false });
    }
  }

  // Férias vencidas e proporcionais
  const periodos = periodosFerias(e.admissao, addDias(dataProjetada, 1), e.feriasGozadas ?? [], diasDireito);
  for (const per of periodos) {
    if (per.status === "GOZADO") continue;
    if (per.status === "EM_AQUISICAO") {
      if (e.tipo === "JUSTA_CAUSA") continue;
      const avos = avosFerias(per.inicioAquisitivo, dataProjetada);
      if (avos === 0) continue;
      const dias = (diasDireito / 12) * avos;
      const valor = arred(diaRem * dias);
      verbas.push({ descricao: `Férias proporcionais (${avos}/12)`, valor, natureza: "provento", incideInss: false, incideFgts: false, formula: `${formatarMoeda(arred(diaRem, 4))}/dia × ${arred(dias, 2)} dias` });
      verbas.push({ descricao: "1/3 sobre férias proporcionais", valor: arred(valor / 3), natureza: "provento", incideInss: false, incideFgts: false });
      continue;
    }
    const restantes = diasDireito - per.diasGozados;
    const vencidaNaData = per.fimConcessivo.getTime() < desl.getTime();
    const fator = vencidaNaData ? 2 : 1;
    const valor = arred(diaRem * restantes * fator);
    const rotulo = `Férias ${vencidaNaData ? "vencidas em dobro" : "vencidas"} (${formatarData(per.inicioAquisitivo)} a ${formatarData(per.fimAquisitivo)})`;
    verbas.push({ descricao: rotulo, valor, natureza: "provento", incideInss: false, incideFgts: false, formula: `${formatarMoeda(arred(diaRem, 4))}/dia × ${restantes} dias${fator === 2 ? " × 2" : ""}` });
    verbas.push({ descricao: "1/3 sobre férias vencidas", valor: arred(valor / 3), natureza: "provento", incideInss: false, incideFgts: false });
    if (vencidaNaData) alertas.push("Há férias vencidas fora do prazo concessivo — pagamento em dobro (CLT art. 137).");
  }

  // Banco de horas
  if (e.saldoBancoHoras && e.saldoBancoHoras > 0) {
    const vh = valorHora(e.salario, e.horasSemanais);
    const valor = arred(vh * 1.5 * e.saldoBancoHoras);
    verbas.push({ descricao: `Saldo do banco de horas (${e.saldoBancoHoras} h + 50%)`, valor, natureza: "provento", incideInss: true, incideFgts: true, formula: `${formatarMoeda(arred(vh, 4))}/h × 1,5 × ${e.saldoBancoHoras} h` });
  }

  // INSS: salário e 13º são calculados separadamente
  const verba13 = verbas.find((v) => v.descricao.startsWith("13º"));
  const baseInssMes = somar(...verbas.filter((v) => v.natureza === "provento" && v.incideInss && v !== verba13).map((v) => v.valor));
  const base13 = verba13?.valor ?? 0;
  const inssMes = calcularInssEmpregado(baseInssMes, e.tabela);
  const inss13 = calcularInssEmpregado(base13, e.tabela);
  if (inssMes.valor) verbas.push({ descricao: "INSS sobre saldo de salário", valor: inssMes.valor, natureza: "desconto", incideInss: false, incideFgts: false });
  if (inss13.valor) verbas.push({ descricao: "INSS sobre 13º", valor: inss13.valor, natureza: "desconto", incideInss: false, incideFgts: false });
  if (e.outrosDescontos) verbas.push({ descricao: "Outros descontos", valor: arred(e.outrosDescontos), natureza: "desconto", incideInss: false, incideFgts: false });

  const proventos = somar(...verbas.filter((v) => v.natureza === "provento").map((v) => v.valor));
  const descontos = somar(...verbas.filter((v) => v.natureza === "desconto").map((v) => v.valor));
  const liquido = somar(proventos, -descontos);
  if (liquido < 0) alertas.push("Os descontos superam os proventos; o desconto do aviso está limitado ao valor disponível (CLT art. 477, § 5º).");

  // DAE da rescisão
  const a = e.tabela.aliquotas;
  const modo = e.tabela.arredondamentoDae;
  const baseFgts = somar(...verbas.filter((v) => v.natureza === "provento" && v.incideFgts).map((v) => v.valor));
  const baseInssTotal = somar(baseInssMes, base13);
  const dae = {
    inssEmpregado: somar(inssMes.valor, inss13.valor),
    inssPatronal: aplicarModo((baseInssTotal * a.inssPatronal) / 100, modo),
    gilrat: aplicarModo((baseInssTotal * a.gilrat) / 100, modo),
    fgts: aplicarModo((baseFgts * a.fgts) / 100, modo),
    fgtsCompensatorio: aplicarModo((baseFgts * a.fgtsCompensatorio) / 100, modo),
    total: 0,
  };
  dae.total = somar(dae.inssEmpregado, dae.inssPatronal, dae.gilrat, dae.fgts, dae.fgtsCompensatorio);

  // FGTS: saque e destino do compensatório (LC 150, art. 22)
  const mesesContrato = Math.max(1, Math.round(diferencaDias(e.admissao, desl) / 30.4375));
  const compensatorio = e.fgtsCompensatorioAcumulado ?? arred(remuneracao * (a.fgtsCompensatorio / 100) * mesesContrato * (13.33 / 12));
  const compensatorioEstimado = e.fgtsCompensatorioAcumulado === undefined;
  let destino: string;
  let paraEmpregado = 0;
  let paraEmpregador = 0;
  let saque: string;
  switch (e.tipo) {
    case "SEM_JUSTA_CAUSA":
    case "ANTECIPADA_EXPERIENCIA_EMPREGADOR":
      destino = "O FGTS compensatório (3,2%) vai para o empregado.";
      paraEmpregado = compensatorio;
      saque = "O empregado pode sacar todo o FGTS (8%) e tem direito ao seguro-desemprego doméstico, se cumprir os requisitos.";
      break;
    case "ACORDO":
      destino = "O FGTS compensatório é dividido: metade para o empregado e metade volta ao empregador.";
      paraEmpregado = arred(compensatorio / 2);
      paraEmpregador = arred(compensatorio - paraEmpregado);
      saque = "O empregado pode sacar até 80% do FGTS (8%) e não tem direito ao seguro-desemprego.";
      break;
    case "TERMINO_CONTRATO":
      destino = "O FGTS compensatório volta para o empregador.";
      paraEmpregador = compensatorio;
      saque = "O empregado pode sacar o FGTS (8%); não há seguro-desemprego.";
      break;
    case "FALECIMENTO":
      destino = "O FGTS compensatório volta para o empregador.";
      paraEmpregador = compensatorio;
      saque = "Os dependentes habilitados no INSS (ou herdeiros) sacam o FGTS e recebem as verbas.";
      break;
    default:
      destino = "O FGTS compensatório volta para o empregador.";
      paraEmpregador = compensatorio;
      saque = "O empregado não pode sacar o FGTS neste tipo de desligamento.";
  }
  const fgtsInfo = {
    saldoFgts: e.saldoFgts ?? null,
    saqueFgts: e.saldoFgts === undefined ? null : arred(e.tipo === "ACORDO" ? e.saldoFgts * 0.8 : ["SEM_JUSTA_CAUSA", "ANTECIPADA_EXPERIENCIA_EMPREGADOR", "TERMINO_CONTRATO", "FALECIMENTO"].includes(e.tipo) ? e.saldoFgts : 0),
    compensatorio,
    compensatorioEstimado,
    paraEmpregado,
    paraEmpregador,
    destino,
    saque,
  };

  const prazoPagamento = addDias(desl, 10);
  for (const v of verbas) memoria.add(`${v.natureza === "provento" ? "(+)" : "(−)"} ${v.descricao}`, v.natureza === "provento" ? v.valor : -v.valor, v.formula);
  memoria.destaque("Líquido da rescisão", liquido);
  memoria.add("DAE da rescisão (estimado)", dae.total, "INSS empregado + patronal + GILRAT + FGTS 8% + 3,2%");
  memoria.nota(destino);
  memoria.nota(saque);
  memoria.nota(`Prazo de pagamento: até ${formatarData(prazoPagamento)} (10 dias corridos, CLT art. 477, § 6º).`);
  if (compensatorioEstimado) memoria.nota("FGTS compensatório estimado pelo tempo de contrato; confira o valor real no extrato do FGTS.");

  return {
    tipo: e.tipo,
    bloqueio,
    diasAviso,
    diasIndenizados,
    dataProjetada,
    verbas,
    proventos,
    descontos,
    liquido: Math.max(0, liquido),
    dae,
    fgts: fgtsInfo,
    prazoPagamento,
    alertas,
    memoria,
  };
}
