import { describe, expect, it } from "vitest";
import { calcularEncargosMensais, calcularFolhaMensal, data, salarioMinimoProporcional, TABELAS_PADRAO, vencimentoDae } from "..";

/**
 * Caso real conferido com o eSocial: empregada em tempo parcial de 22h semanais,
 * salário de R$ 810,50, admitida em 09/02/2026. Fevereiro/2026: salário proporcional
 * de R$ 578,93 e DAE de R$ 159,18.
 */
describe("caso real — fevereiro/2026 (parcial 22h, admissão 09/02/2026)", () => {
  const t = TABELAS_PADRAO[2026];

  it("salário contratado é o mínimo proporcional de 22h", () => {
    expect(salarioMinimoProporcional(t.salarioMinimo, 22)).toBe(810.5);
  });

  it("folha de fevereiro gera salário proporcional de R$ 578,93 e DAE de R$ 159,18", () => {
    const f = calcularFolhaMensal({ ano: 2026, mes: 2, salario: 810.5, horasSemanais: 22, admissao: data(2026, 2, 9), tabela: t });
    expect(f.diasTrabalhados).toBe(20);
    expect(f.proventos[0].valor).toBe(578.93);
    expect(f.baseInss).toBe(578.93);
    expect(f.encargos.inssEmpregado).toBe(43.41);
    expect(f.encargos.inssPatronal).toBe(46.31);
    expect(f.encargos.gilrat).toBe(4.63);
    expect(f.encargos.fgts).toBe(46.31);
    expect(f.encargos.fgtsCompensatorio).toBe(18.52);
    expect(f.encargos.totalDae).toBe(159.18);
    expect(f.liquido).toBe(535.52);
  });

  it("DAE de fevereiro vence em 06/03/2026 (dia 7 cai no sábado)", () => {
    expect(vencimentoDae(2026, 2)).toEqual(data(2026, 3, 6));
  });

  it("com arredondamento (em vez de truncamento) o DAE seria R$ 159,20", () => {
    const e = calcularEncargosMensais({ baseInss: 578.93, tabela: { ...t, arredondamentoDae: "arredondar" } });
    expect(e.totalDae).toBe(159.2);
  });

  it("mês cheio (março/2026) gera DAE sobre o salário integral", () => {
    const f = calcularFolhaMensal({ ano: 2026, mes: 3, salario: 810.5, horasSemanais: 22, admissao: data(2026, 2, 9), tabela: t });
    expect(f.proventos[0].valor).toBe(810.5);
    // 7,5% = 60,7875 → 60,78; 8% = 64,84; 0,8% = 6,484 → 6,48; 8% = 64,84; 3,2% = 25,936 → 25,93
    expect(f.encargos.totalDae).toBe(222.87);
  });
});
