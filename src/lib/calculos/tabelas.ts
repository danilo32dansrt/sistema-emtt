import type { ModoArredondamento } from "./dinheiro";

export interface FaixaInss {
  /** Limite superior da faixa (null = sem limite, não usado pois há teto). */
  ate: number;
  /** Alíquota em % (ex.: 7.5). */
  aliquota: number;
}

export interface AliquotasEmpregador {
  inssPatronal: number;
  gilrat: number;
  fgts: number;
  fgtsCompensatorio: number;
}

/**
 * Tabela anual. No sistema ela fica no banco (editável por ano);
 * os valores abaixo são apenas os padrões usados nos testes e na carga inicial.
 */
export interface TabelaAnual {
  ano: number;
  salarioMinimo: number;
  faixasInss: FaixaInss[];
  salarioFamiliaLimite: number;
  salarioFamiliaCota: number;
  aliquotas: AliquotasEmpregador;
  /** O eSocial trunca as parcelas do DAE; deixamos configurável. */
  arredondamentoDae: ModoArredondamento;
  /** Multa e juros do DAE em atraso (se omitido, usa 0,33%/dia até 20%, Selic 1% e 1% no mês do pagamento). */
  dae?: { multaDiaria: number; multaMaxima: number; selicMensal: number; jurosMesPagamento: number };
}

export const ALIQUOTAS_PADRAO: AliquotasEmpregador = {
  inssPatronal: 8,
  gilrat: 0.8,
  fgts: 8,
  fgtsCompensatorio: 3.2,
};

export const TABELAS_PADRAO: Record<number, TabelaAnual> = {
  2024: {
    ano: 2024,
    salarioMinimo: 1412.0,
    faixasInss: [
      { ate: 1412.0, aliquota: 7.5 },
      { ate: 2666.68, aliquota: 9 },
      { ate: 4000.03, aliquota: 12 },
      { ate: 7786.02, aliquota: 14 },
    ],
    salarioFamiliaLimite: 1819.26,
    salarioFamiliaCota: 62.04,
    aliquotas: ALIQUOTAS_PADRAO,
    arredondamentoDae: "truncar",
  },
  2025: {
    ano: 2025,
    salarioMinimo: 1518.0,
    faixasInss: [
      { ate: 1518.0, aliquota: 7.5 },
      { ate: 2793.88, aliquota: 9 },
      { ate: 4190.83, aliquota: 12 },
      { ate: 8157.41, aliquota: 14 },
    ],
    salarioFamiliaLimite: 1906.04,
    salarioFamiliaCota: 65.0,
    aliquotas: ALIQUOTAS_PADRAO,
    arredondamentoDae: "truncar",
  },
  2026: {
    ano: 2026,
    salarioMinimo: 1621.0,
    faixasInss: [
      { ate: 1621.0, aliquota: 7.5 },
      { ate: 2902.84, aliquota: 9 },
      { ate: 4354.27, aliquota: 12 },
      { ate: 8475.55, aliquota: 14 },
    ],
    salarioFamiliaLimite: 1980.38,
    salarioFamiliaCota: 67.54,
    aliquotas: ALIQUOTAS_PADRAO,
    arredondamentoDae: "truncar",
  },
};

export function tetoInss(tabela: TabelaAnual): number {
  return tabela.faixasInss[tabela.faixasInss.length - 1].ate;
}

/** Busca a tabela do ano; se não existir, usa a mais recente anterior (avisando via `aproximada`). */
export function escolherTabela(tabelas: TabelaAnual[] | Record<number, TabelaAnual>, ano: number) {
  const lista = Array.isArray(tabelas) ? tabelas : Object.values(tabelas);
  const exata = lista.find((t) => t.ano === ano);
  if (exata) return { tabela: exata, aproximada: false };
  const anteriores = lista.filter((t) => t.ano < ano).sort((a, b) => b.ano - a.ano);
  const fallback = anteriores[0] ?? [...lista].sort((a, b) => a.ano - b.ano)[0];
  if (!fallback) throw new Error("Nenhuma tabela anual cadastrada.");
  return { tabela: fallback, aproximada: true };
}

export function validarTabela(t: TabelaAnual): string[] {
  const erros: string[] = [];
  if (t.salarioMinimo <= 0) erros.push("Salário mínimo deve ser maior que zero.");
  if (!t.faixasInss.length) erros.push("Informe ao menos uma faixa de INSS.");
  let anterior = 0;
  t.faixasInss.forEach((f, i) => {
    if (f.ate <= anterior) erros.push(`Faixa ${i + 1} do INSS deve ter limite maior que a anterior.`);
    if (f.aliquota <= 0 || f.aliquota > 100) erros.push(`Faixa ${i + 1} do INSS com alíquota inválida.`);
    anterior = f.ate;
  });
  if (t.salarioFamiliaCota < 0 || t.salarioFamiliaLimite < 0) erros.push("Valores de salário-família inválidos.");
  return erros;
}
