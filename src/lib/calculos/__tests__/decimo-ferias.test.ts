import { describe, expect, it } from "vitest";
import {
  avosDecimoTerceiro, avosFerias, calcularDecimoTerceiro, calcularFerias, data, diasDireitoFerias,
  diasFeriasParcialLC150, periodosFerias, TABELAS_PADRAO, validarFracionamento,
} from "..";

const t = TABELAS_PADRAO[2026];

describe("13º salário", () => {
  it("conta avos com 15 dias ou mais no mês", () => {
    expect(avosDecimoTerceiro(2026, data(2026, 2, 9)).avos).toBe(11);
    expect(avosDecimoTerceiro(2026, data(2026, 2, 17)).avos).toBe(10);
    expect(avosDecimoTerceiro(2026, data(2020, 1, 1), data(2026, 7, 14)).avos).toBe(6);
    expect(avosDecimoTerceiro(2026, data(2020, 1, 1), data(2026, 7, 15)).avos).toBe(7);
  });

  it("calcula 1ª e 2ª parcelas do caso real", () => {
    const r = calcularDecimoTerceiro({ ano: 2026, salario: 810.5, admissao: data(2026, 2, 9), tabela: t });
    expect(r.avosNovembro).toBe(10);
    expect(r.avos).toBe(11);
    expect(r.primeiraParcela).toBe(371.48);
    expect(r.total).toBe(742.96);
    expect(r.inss).toBe(55.72);
    expect(r.segundaParcela).toBe(315.76);
    expect(r.prazoPrimeira).toEqual(data(2026, 11, 30));
    // 20/12/2026 é domingo → 18/12 (sexta)
    expect(r.prazoSegunda).toEqual(data(2026, 12, 18));
  });

  it("ano completo: 1ª parcela é metade do salário", () => {
    const r = calcularDecimoTerceiro({ ano: 2026, salario: 1621, admissao: data(2020, 1, 1), tabela: t });
    expect(r.primeiraParcela).toBe(810.5);
    expect(r.total).toBe(1621);
    expect(r.dae.inssPatronal).toBe(129.68);
    expect(r.dae.gilrat).toBe(12.96);
  });
});

describe("férias", () => {
  it("lista períodos aquisitivos e concessivos", () => {
    const p = periodosFerias(data(2026, 2, 9), data(2027, 3, 1));
    expect(p).toHaveLength(2);
    expect(p[0].fimAquisitivo).toEqual(data(2027, 2, 8));
    expect(p[0].fimConcessivo).toEqual(data(2028, 2, 8));
    expect(p[0].status).toBe("A_GOZAR");
    expect(p[1].status).toBe("EM_AQUISICAO");
  });

  it("marca período vencido e gozado", () => {
    const p = periodosFerias(data(2023, 1, 10), data(2026, 3, 1), [{ inicioAquisitivo: data(2024, 1, 10), dias: 30 }]);
    expect(p[0].status).toBe("VENCIDO");
    expect(p[1].status).toBe("GOZADO");
    expect(p[2].status).toBe("A_GOZAR");
  });

  it("dias de direito", () => {
    expect(diasDireitoFerias("INTEGRAL", 44, 3).dias).toBe(30);
    expect(diasDireitoFerias("INTEGRAL", 44, 10).dias).toBe(24);
    expect(diasDireitoFerias("INTEGRAL", 44, 40).dias).toBe(0);
    expect(diasDireitoFerias("PARCIAL", 22, 0, "LC150").dias).toBe(16);
    expect(diasDireitoFerias("PARCIAL", 22, 0, "CLT").dias).toBe(30);
    expect(diasFeriasParcialLC150(25)).toBe(18);
    expect(diasFeriasParcialLC150(5)).toBe(8);
  });

  it("avos de férias proporcionais", () => {
    expect(avosFerias(data(2026, 2, 9), data(2026, 2, 23))).toBe(1);
    expect(avosFerias(data(2026, 2, 9), data(2026, 2, 22))).toBe(0);
    expect(avosFerias(data(2026, 2, 9), data(2026, 8, 8))).toBe(6);
    expect(avosFerias(data(2026, 2, 9), data(2027, 5, 1))).toBe(12);
  });

  it("valida o fracionamento em até 2 períodos (um com 14+ dias)", () => {
    expect(validarFracionamento([14, 16], 30)).toEqual([]);
    expect(validarFracionamento([10, 10, 10], 30).length).toBeGreaterThan(0);
    expect(validarFracionamento([10, 10], 30)).toContain("Um dos períodos deve ter no mínimo 14 dias corridos.");
    expect(validarFracionamento([20], 30, 11).length).toBeGreaterThan(0);
    expect(validarFracionamento([20], 30, 10)).toEqual([]);
  });

  it("calcula férias com 1/3 e INSS", () => {
    const r = calcularFerias({ salario: 1621, diasGozo: 30, tabela: t, inicioGozo: data(2026, 7, 1) });
    expect(r.ferias).toBe(1621);
    expect(r.terco).toBe(540.33);
    expect(r.inss).toBe(170.2);
    expect(r.liquido).toBe(1991.13);
    expect(r.prazos!.pagamento).toEqual(data(2026, 6, 29));
    expect(r.prazos!.aviso).toEqual(data(2026, 6, 1));
    expect(r.prazos!.retorno).toEqual(data(2026, 7, 31));
  });

  it("calcula abono pecuniário e férias em dobro", () => {
    const r = calcularFerias({ salario: 1621, diasGozo: 20, diasAbono: 10, tabela: t });
    expect(r.ferias).toBe(1080.67);
    expect(r.terco).toBe(360.22);
    expect(r.abono).toBe(540.33);
    expect(r.tercoAbono).toBe(180.11);
    const d = calcularFerias({ salario: 1621, diasGozo: 30, tabela: t, emDobro: true });
    expect(d.ferias).toBe(3242);
  });
});
