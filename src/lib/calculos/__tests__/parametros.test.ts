import { describe, expect, it } from "vitest";
import { calcularEncargosMensais, data, PARAMETROS_PADRAO, parametrosSemConferencia, parametrosSociais, tabelaNaData, tabelasPorAno, valorVigente } from "..";

describe("tabela de parâmetros com vigência", () => {
  it("usa o valor vigente na data (meses passados usam o valor da época)", () => {
    expect(valorVigente(PARAMETROS_PADRAO, "SALARIO_MINIMO", data(2025, 12, 31))).toBe(1518);
    expect(valorVigente(PARAMETROS_PADRAO, "SALARIO_MINIMO", data(2026, 1, 1))).toBe(1621);
    expect(valorVigente(PARAMETROS_PADRAO, "SALARIO_MINIMO", data(2020, 1, 1))).toBeUndefined();
  });

  it("vigência no meio do ano muda o cálculo só a partir da data", () => {
    const lista = [...PARAMETROS_PADRAO, { chave: "SALARIO_MINIMO", valor: 1700, vigenciaInicio: data(2026, 5, 1) }];
    expect(tabelaNaData(lista, data(2026, 4, 30)).salarioMinimo).toBe(1621);
    expect(tabelaNaData(lista, data(2026, 5, 1)).salarioMinimo).toBe(1700);
  });

  it("monta a tabela que reproduz o DAE real de fevereiro/2026", () => {
    const t = tabelaNaData(PARAMETROS_PADRAO, data(2026, 2, 1));
    expect(calcularEncargosMensais({ baseInss: 578.93, tabela: t }).totalDae).toBe(159.18);
    expect(t.dae).toEqual({ multaDiaria: 0.33, multaMaxima: 20, selicMensal: 1, jurosMesPagamento: 1 });
  });

  it("gera tabelas por ano e parâmetros sociais", () => {
    const anos = tabelasPorAno(PARAMETROS_PADRAO, data(2026, 10, 21)).map((t) => t.ano);
    expect(anos).toEqual(expect.arrayContaining([2024, 2025, 2026]));
    const p = parametrosSociais(PARAMETROS_PADRAO, data(2026, 10, 21));
    expect(p.bfProtecaoLimite).toBe(706);
    expect(p.bfProtecaoMeses).toBe(12);
    // Até maio/2025 valia a regra antiga (meio salário mínimo e 24 meses)
    const antiga = parametrosSociais(PARAMETROS_PADRAO, data(2025, 5, 31));
    expect(antiga.bfProtecaoLimite).toBe(759);
    expect(antiga.bfProtecaoMeses).toBe(24);
    expect(p.bfLinhaPobreza).toBe(218);
  });

  it("aponta parâmetros sem conferência há mais de 6 meses", () => {
    const r = parametrosSemConferencia([{ chave: "A", ultimaConferencia: data(2026, 1, 10) }, { chave: "B", ultimaConferencia: data(2026, 9, 1) }, { chave: "C", ultimaConferencia: null }], data(2026, 10, 21));
    expect(r.map((x) => x.chave)).toEqual(["A", "C"]);
  });
});
