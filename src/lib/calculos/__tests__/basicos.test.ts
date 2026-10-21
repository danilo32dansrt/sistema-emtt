import { describe, expect, it } from "vitest";
import {
  addMeses, arred, calcularInssEmpregado, calcularSalarioFamilia, calcularValeTransporte, cpfValido, data,
  diaUtilAnteriorOuIgual, diasNoMes, feriadosNacionais, formatarData, formatarMoeda, lerData, lerMoeda,
  mascararCpf, pascoa, TABELAS_PADRAO, truncar, validarTabela,
} from "..";

const t26 = TABELAS_PADRAO[2026];

describe("dinheiro", () => {
  it("arredonda e trunca corretamente", () => {
    expect(arred(578.928571)).toBe(578.93);
    expect(arred(1.005)).toBe(1.01);
    expect(arred(-2.345)).toBe(-2.35);
    expect(truncar(43.41975)).toBe(43.41);
    expect(truncar(46.31)).toBe(46.31);
    expect(truncar(0.29 * 100 / 100)).toBe(0.29);
  });
  it("formata e lê moeda brasileira", () => {
    expect(formatarMoeda(1234.5)).toBe("R$ 1.234,50");
    expect(lerMoeda("R$ 1.234,56")).toBe(1234.56);
    expect(lerMoeda("810,50")).toBe(810.5);
    expect(lerMoeda("810.50")).toBe(810.5);
    expect(() => lerMoeda("abc")).toThrow();
  });
});

describe("datas", () => {
  it("lê e formata dd/mm/aaaa", () => {
    expect(formatarData(lerData("09/02/2026"))).toBe("09/02/2026");
    expect(formatarData(lerData("2026-02-09"))).toBe("09/02/2026");
    expect(() => lerData("31/02/2026")).toThrow();
  });
  it("calcula páscoa e feriados nacionais", () => {
    expect(pascoa(2026)).toEqual(data(2026, 4, 5));
    const f = feriadosNacionais(2026).map((x) => formatarData(x.data));
    expect(f).toContain("03/04/2026");
    expect(f).toContain("20/11/2026");
    expect(f).toHaveLength(10);
  });
  it("volta para o dia útil anterior", () => {
    expect(diaUtilAnteriorOuIgual(data(2026, 3, 7))).toEqual(data(2026, 3, 6));
    // 07/09/2026 é feriado (segunda) → 04/09 (sexta)
    expect(diaUtilAnteriorOuIgual(data(2026, 9, 7))).toEqual(data(2026, 9, 4));
  });
  it("soma meses respeitando fim de mês", () => {
    expect(addMeses(data(2026, 1, 31), 1)).toEqual(data(2026, 2, 28));
    expect(diasNoMes(2028, 2)).toBe(29);
  });
});

describe("INSS progressivo", () => {
  it("calcula por faixas (2026)", () => {
    expect(calcularInssEmpregado(3000, t26, "truncar").valor).toBe(248.59);
    expect(calcularInssEmpregado(3000, t26, "arredondar").valor).toBe(248.6);
  });
  it("limita ao teto", () => {
    expect(calcularInssEmpregado(10000, t26, "arredondar").valor).toBe(988.09);
    expect(calcularInssEmpregado(8475.55, t26, "arredondar").valor).toBe(988.09);
  });
  it("salário mínimo 2025", () => {
    expect(calcularInssEmpregado(1518, TABELAS_PADRAO[2025], "arredondar").valor).toBe(113.85);
  });
  it("valida tabela", () => {
    expect(validarTabela(t26)).toEqual([]);
    expect(validarTabela({ ...t26, faixasInss: [{ ate: 100, aliquota: 7.5 }, { ate: 50, aliquota: 9 }] })).toHaveLength(1);
  });
});

describe("benefícios", () => {
  it("salário-família por dependente até o limite", () => {
    expect(calcularSalarioFamilia(1621, 2, t26).valor).toBe(135.08);
    expect(calcularSalarioFamilia(2500, 2, t26).direito).toBe(false);
    expect(calcularSalarioFamilia(1621, 0, t26).valor).toBe(0);
  });
  it("vale-transporte com desconto de até 6%", () => {
    const vt = calcularValeTransporte(1621, 300);
    expect(vt.descontoEmpregado).toBe(97.26);
    expect(vt.custoEmpregador).toBe(202.74);
    expect(calcularValeTransporte(1621, 50).descontoEmpregado).toBe(50);
  });
});

describe("CPF", () => {
  it("valida e mascara", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(mascararCpf("52998224725")).toBe("***.982.247-**");
  });
});
