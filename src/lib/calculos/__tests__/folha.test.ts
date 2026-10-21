import { describe, expect, it } from "vitest";
import { calcularFolhaMensal, data, descontoFaltas, semanasDistintas, TABELAS_PADRAO, valorHorasExtras } from "..";

const t = TABELAS_PADRAO[2026];

describe("folha mensal", () => {
  it("hora extra 50% com reflexo no DSR", () => {
    const f = calcularFolhaMensal({ ano: 2026, mes: 3, salario: 1621, horasSemanais: 44, admissao: data(2025, 1, 1), tabela: t, horasExtras50: 10 });
    const he = f.proventos.find((p) => p.descricao.startsWith("Horas extras 50%"))!;
    expect(he.valor).toBe(110.52);
    const dsr = f.proventos.find((p) => p.descricao.startsWith("DSR"))!;
    // março/2026: 26 dias úteis e 5 domingos
    expect(dsr.valor).toBe(21.25);
    expect(f.baseInss).toBe(1752.77);
  });

  it("hora extra 100% e adicional noturno", () => {
    expect(valorHorasExtras(1621, 44, 2, 100).valor).toBe(29.47);
    const f = calcularFolhaMensal({ ano: 2026, mes: 3, salario: 1621, horasSemanais: 44, admissao: data(2025, 1, 1), tabela: t, horasNoturnas: 8, reflexoDsr: false });
    expect(f.proventos.find((p) => p.descricao.startsWith("Adicional noturno"))!.valor).toBe(11.79);
  });

  it("faltas injustificadas descontam o dia e o DSR da semana", () => {
    const d = descontoFaltas(1621, 2, 1);
    expect(d.faltas).toBe(108.07);
    expect(d.dsr).toBe(54.03);
    expect(semanasDistintas([data(2026, 3, 2), data(2026, 3, 4), data(2026, 3, 10)])).toBe(2);
    const f = calcularFolhaMensal({ ano: 2026, mes: 3, salario: 1621, horasSemanais: 44, admissao: data(2025, 1, 1), tabela: t, faltasInjustificadas: 2, semanasComFalta: 1 });
    expect(f.baseInss).toBe(1458.9);
  });

  it("desconta adiantamento e vale-transporte e paga salário-família", () => {
    const f = calcularFolhaMensal({ ano: 2026, mes: 3, salario: 1621, horasSemanais: 44, admissao: data(2025, 1, 1), tabela: t, adiantamento: 400, custoValeTransporte: 200, dependentesSalarioFamilia: 1 });
    expect(f.salarioFamilia).toBe(67.54);
    expect(f.encargos.deducoes).toBe(67.54);
    expect(f.descontos.find((d) => d.descricao.startsWith("Vale"))!.valor).toBe(97.26);
    // 1621 + 67,54 − INSS 121,57 − VT 97,26 − adiantamento 400
    expect(f.liquido).toBe(1069.71);
  });

  it("desligamento no meio do mês", () => {
    const f = calcularFolhaMensal({ ano: 2026, mes: 4, salario: 1621, horasSemanais: 44, admissao: data(2025, 1, 1), desligamento: data(2026, 4, 10), tabela: t });
    expect(f.diasTrabalhados).toBe(10);
    expect(f.proventos[0].valor).toBe(540.33);
  });

  it("sem vínculo no mês gera tudo zerado", () => {
    const f = calcularFolhaMensal({ ano: 2026, mes: 1, salario: 1621, horasSemanais: 44, admissao: data(2026, 2, 9), tabela: t });
    expect(f.diasTrabalhados).toBe(0);
    expect(f.encargos.totalDae).toBe(0);
  });
});
