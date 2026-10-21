import { addMeses, data, diferencaDias, soData } from "./datas";
import type { ModoArredondamento } from "./dinheiro";
import type { FaixaInss, TabelaAnual } from "./tabelas";

/**
 * Tabela única de parâmetros legais com data de vigência. Nenhum valor legal fica
 * fixo no código: os cálculos sempre buscam o valor vigente na data de referência
 * (cálculos de meses passados usam o valor da época).
 */

export type TipoParametro = "moeda" | "percentual" | "numero" | "faixas" | "texto";

export interface DefinicaoParametro {
  chave: string;
  rotulo: string;
  grupo: string;
  tipo: TipoParametro;
  descricao: string;
  fonte: string;
}

const GOV_INSS = "https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal";
const GOV_BF = "https://www.gov.br/mds/pt-br/acoes-e-programas/bolsa-familia";
const GOV_ESOCIAL = "https://www.gov.br/esocial/pt-br/empregador-domestico";

export const DEFINICOES_PARAMETROS: DefinicaoParametro[] = [
  { chave: "SALARIO_MINIMO", rotulo: "Salário mínimo", grupo: "Salário mínimo", tipo: "moeda", descricao: "Valor nacional mensal (decreto anual).", fonte: "https://www.gov.br/planalto/pt-br/legislacao" },
  { chave: "INSS_FAIXAS", rotulo: "Faixas do INSS do empregado", grupo: "INSS", tipo: "faixas", descricao: "Tabela progressiva: limite de cada faixa e alíquota.", fonte: GOV_INSS },
  { chave: "INSS_PATRONAL", rotulo: "INSS patronal", grupo: "Encargos do empregador", tipo: "percentual", descricao: "Contribuição do empregador doméstico (LC 150, art. 34).", fonte: GOV_ESOCIAL },
  { chave: "GILRAT", rotulo: "Seguro contra acidentes (GILRAT)", grupo: "Encargos do empregador", tipo: "percentual", descricao: "LC 150, art. 34, III.", fonte: GOV_ESOCIAL },
  { chave: "FGTS", rotulo: "FGTS", grupo: "Encargos do empregador", tipo: "percentual", descricao: "Depósito mensal do FGTS.", fonte: GOV_ESOCIAL },
  { chave: "FGTS_COMPENSATORIO", rotulo: "FGTS compensatório (indenização)", grupo: "Encargos do empregador", tipo: "percentual", descricao: "LC 150, art. 22.", fonte: GOV_ESOCIAL },
  { chave: "DAE_ARREDONDAMENTO", rotulo: "Centavos no DAE", grupo: "Encargos do empregador", tipo: "texto", descricao: '"truncar" (como o eSocial) ou "arredondar".', fonte: GOV_ESOCIAL },
  { chave: "SALARIO_FAMILIA_LIMITE", rotulo: "Salário-família: teto de remuneração", grupo: "Salário-família", tipo: "moeda", descricao: "Remuneração máxima para ter direito.", fonte: GOV_INSS },
  { chave: "SALARIO_FAMILIA_COTA", rotulo: "Salário-família: valor da cota", grupo: "Salário-família", tipo: "moeda", descricao: "Valor por filho de até 14 anos.", fonte: GOV_INSS },
  { chave: "DAE_MULTA_DIARIA", rotulo: "Multa de mora por dia", grupo: "DAE em atraso", tipo: "percentual", descricao: "Lei 9.430/1996, art. 61.", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l9430.htm" },
  { chave: "DAE_MULTA_MAXIMA", rotulo: "Multa de mora máxima", grupo: "DAE em atraso", tipo: "percentual", descricao: "Limite da multa de mora.", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l9430.htm" },
  { chave: "DAE_SELIC_MENSAL", rotulo: "Selic mensal estimada", grupo: "DAE em atraso", tipo: "percentual", descricao: "Usada para estimar os juros de mora (confira a taxa do mês).", fonte: "https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/pagamentos-e-parcelamentos/taxa-de-juros-selic" },
  { chave: "DAE_JUROS_MES_PAGAMENTO", rotulo: "Juros no mês do pagamento", grupo: "DAE em atraso", tipo: "percentual", descricao: "Acréscimo fixo no mês em que o DAE atrasado é pago.", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l9430.htm" },
  { chave: "BF_LINHA_POBREZA", rotulo: "Bolsa Família: renda por pessoa para entrar", grupo: "Bolsa Família", tipo: "moeda", descricao: "Renda mensal por pessoa máxima para receber o benefício integral (Lei 14.601/2023).", fonte: GOV_BF },
  { chave: "BF_RENDA_CIDADANIA", rotulo: "Bolsa Família: valor por pessoa", grupo: "Bolsa Família", tipo: "moeda", descricao: "Benefício de Renda de Cidadania, por integrante.", fonte: GOV_BF },
  { chave: "BF_MINIMO_FAMILIA", rotulo: "Bolsa Família: mínimo por família", grupo: "Bolsa Família", tipo: "moeda", descricao: "Benefício complementar garante este mínimo (antes dos adicionais).", fonte: GOV_BF },
  { chave: "BF_PRIMEIRA_INFANCIA", rotulo: "Bolsa Família: por criança de 0 a 6 anos", grupo: "Bolsa Família", tipo: "moeda", descricao: "Benefício Primeira Infância.", fonte: GOV_BF },
  { chave: "BF_VARIAVEL_FAMILIAR", rotulo: "Bolsa Família: por gestante, nutriz ou criança/adolescente de 7 a 17", grupo: "Bolsa Família", tipo: "moeda", descricao: "Benefício Variável Familiar.", fonte: GOV_BF },
  { chave: "BF_PROTECAO_LIMITE", rotulo: "Regra de proteção: renda por pessoa máxima", grupo: "Bolsa Família", tipo: "moeda", descricao: "Até este valor por pessoa a família fica na regra de proteção (padrão: meio salário mínimo).", fonte: GOV_BF },
  { chave: "BF_PROTECAO_PERCENTUAL", rotulo: "Regra de proteção: parte do benefício mantida", grupo: "Bolsa Família", tipo: "percentual", descricao: "Percentual do benefício pago durante a regra de proteção.", fonte: GOV_BF },
  { chave: "BF_PROTECAO_MESES", rotulo: "Regra de proteção: duração (meses)", grupo: "Bolsa Família", tipo: "numero", descricao: "Por quanto tempo a família fica na regra de proteção.", fonte: GOV_BF },
  { chave: "BPC_FRACAO_SM", rotulo: "BPC: renda por pessoa (fração do salário mínimo)", grupo: "BPC", tipo: "numero", descricao: "Critério de renda do BPC/LOAS (Lei 8.742/1993, art. 20, § 3º): 0,25 = 1/4 do salário mínimo.", fonte: "https://www.gov.br/inss/pt-br/direitos-e-deveres/beneficios-assistenciais" },
];

export function definicao(chave: string): DefinicaoParametro | undefined {
  return DEFINICOES_PARAMETROS.find((d) => d.chave === chave);
}

export interface RegistroParametro {
  chave: string;
  /** Número, texto ou faixas (JSON). */
  valor: unknown;
  vigenciaInicio: Date;
}

/** Valor vigente na data (o de início de vigência mais recente que não seja posterior à data). */
export function valorVigente<T = number>(lista: RegistroParametro[], chave: string, ref: Date): T | undefined {
  const d = soData(ref).getTime();
  let melhor: RegistroParametro | undefined;
  for (const r of lista) {
    if (r.chave !== chave || soData(r.vigenciaInicio).getTime() > d) continue;
    if (!melhor || r.vigenciaInicio > melhor.vigenciaInicio) melhor = r;
  }
  return melhor?.valor as T | undefined;
}

export interface ParametrosDae {
  multaDiaria: number;
  multaMaxima: number;
  selicMensal: number;
  jurosMesPagamento: number;
}

export interface ParametrosSociais {
  salarioMinimo: number;
  bfLinhaPobreza: number;
  bfRendaCidadania: number;
  bfMinimoFamilia: number;
  bfPrimeiraInfancia: number;
  bfVariavelFamiliar: number;
  bfProtecaoLimite: number;
  bfProtecaoPercentual: number;
  bfProtecaoMeses: number;
  bpcFracaoSm: number;
}

function exigir<T>(v: T | undefined, chave: string, ref: Date): T {
  if (v === undefined || v === null) throw new Error(`Parâmetro ${definicao(chave)?.rotulo ?? chave} não cadastrado para ${ref.toISOString().slice(0, 10)}.`);
  return v;
}

/** Monta a tabela usada pelos cálculos com os valores vigentes na data de referência. */
export function tabelaNaData(lista: RegistroParametro[], ref: Date): TabelaAnual {
  const n = (k: string) => Number(exigir(valorVigente(lista, k, ref), k, ref));
  const faixas = exigir(valorVigente<FaixaInss[]>(lista, "INSS_FAIXAS", ref), "INSS_FAIXAS", ref).map((f) => ({ ate: Number(f.ate), aliquota: Number(f.aliquota) }));
  const arred = valorVigente<string>(lista, "DAE_ARREDONDAMENTO", ref);
  return {
    ano: ref.getUTCFullYear(),
    salarioMinimo: n("SALARIO_MINIMO"),
    faixasInss: faixas,
    salarioFamiliaLimite: n("SALARIO_FAMILIA_LIMITE"),
    salarioFamiliaCota: n("SALARIO_FAMILIA_COTA"),
    aliquotas: { inssPatronal: n("INSS_PATRONAL"), gilrat: n("GILRAT"), fgts: n("FGTS"), fgtsCompensatorio: n("FGTS_COMPENSATORIO") },
    arredondamentoDae: (arred === "arredondar" ? "arredondar" : "truncar") as ModoArredondamento,
    dae: {
      multaDiaria: Number(valorVigente(lista, "DAE_MULTA_DIARIA", ref) ?? 0.33),
      multaMaxima: Number(valorVigente(lista, "DAE_MULTA_MAXIMA", ref) ?? 20),
      selicMensal: Number(valorVigente(lista, "DAE_SELIC_MENSAL", ref) ?? 1),
      jurosMesPagamento: Number(valorVigente(lista, "DAE_JUROS_MES_PAGAMENTO", ref) ?? 1),
    },
  };
}

/** Uma tabela por ano (vigente em 31/12, ou hoje no ano corrente) — usada nas calculadoras do navegador. */
export function tabelasPorAno(lista: RegistroParametro[], hoje: Date): TabelaAnual[] {
  const anos = new Set(lista.map((r) => r.vigenciaInicio.getUTCFullYear()));
  anos.add(hoje.getUTCFullYear());
  const tabelas: TabelaAnual[] = [];
  for (const ano of [...anos].sort()) {
    const ref = ano === hoje.getUTCFullYear() ? hoje : ano > hoje.getUTCFullYear() ? data(ano, 12, 31) : data(ano, 12, 31);
    try {
      tabelas.push({ ...tabelaNaData(lista, ref), ano });
    } catch {
      /* ano sem todos os parâmetros: ignorado */
    }
  }
  return tabelas;
}

export function parametrosSociais(lista: RegistroParametro[], ref: Date): ParametrosSociais {
  const n = (k: string) => Number(exigir(valorVigente(lista, k, ref), k, ref));
  const sm = n("SALARIO_MINIMO");
  return {
    salarioMinimo: sm,
    bfLinhaPobreza: n("BF_LINHA_POBREZA"),
    bfRendaCidadania: n("BF_RENDA_CIDADANIA"),
    bfMinimoFamilia: n("BF_MINIMO_FAMILIA"),
    bfPrimeiraInfancia: n("BF_PRIMEIRA_INFANCIA"),
    bfVariavelFamiliar: n("BF_VARIAVEL_FAMILIAR"),
    bfProtecaoLimite: Number(valorVigente(lista, "BF_PROTECAO_LIMITE", ref) ?? sm / 2),
    bfProtecaoPercentual: n("BF_PROTECAO_PERCENTUAL"),
    bfProtecaoMeses: n("BF_PROTECAO_MESES"),
    bpcFracaoSm: n("BPC_FRACAO_SM"),
  };
}

/** Parâmetros que precisam de conferência: sem conferir há mais de `meses` meses. */
export function parametrosSemConferencia(itens: { chave: string; ultimaConferencia: Date | null }[], hoje: Date, meses = 6) {
  const limite = addMeses(soData(hoje), -meses);
  return itens
    .filter((i) => !i.ultimaConferencia || soData(i.ultimaConferencia) < limite)
    .map((i) => ({ ...i, dias: i.ultimaConferencia ? diferencaDias(i.ultimaConferencia, hoje) : null }));
}
