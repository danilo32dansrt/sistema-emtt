import { describe, expect, it } from "vitest";
import { codigoBarrasValido, composicaoCobrancaPlus, dataPagamentoDae, statusPorSituacaoInter, vencimentoCobrancaPlus } from "./plus";

const d = (a: number, m: number, dd: number) => new Date(Date.UTC(a, m - 1, dd));

describe("plano Plus — cobrança única", () => {
  it("soma mensalidade + DAEs e só libera com todos os DAEs emitidos", () => {
    expect(composicaoCobrancaPlus(150, [{ empregado: "Maria", emitido: true, valor: 222.89 }, { empregado: "Rosa", emitido: true, valor: 498.1 }])).toEqual({ pronta: true, faltando: [], valorDae: 720.99, total: 870.99 });
    const r = composicaoCobrancaPlus(150, [{ empregado: "Maria", emitido: true, valor: 222.89 }, { empregado: "Rosa", emitido: false, valor: 0 }]);
    expect(r.pronta).toBe(false);
    expect(r.faltando).toEqual(["Rosa"]);
  });

  it("vence no dia combinado, sempre antes do DAE; se já passou, vence hoje", () => {
    expect(vencimentoCobrancaPlus(d(2026, 11, 3), d(2026, 11, 6), 5)).toEqual(d(2026, 11, 5));
    // DAE antecipado para o dia 4 (dia 7 no fim de semana/feriado): cobrança no dia 3
    expect(vencimentoCobrancaPlus(d(2026, 11, 2), d(2026, 11, 4), 5)).toEqual(d(2026, 11, 3));
    expect(vencimentoCobrancaPlus(d(2026, 11, 6), d(2026, 11, 6), 5)).toEqual(d(2026, 11, 6));
  });
});

describe("plano Plus — pagamento do DAE", () => {
  it("agenda para o vencimento; DAE vencido exige nova guia", () => {
    expect(dataPagamentoDae(d(2026, 11, 5), d(2026, 11, 6))).toEqual({ ok: true, data: "2026-11-06" });
    expect(dataPagamentoDae(d(2026, 11, 6), d(2026, 11, 6))).toEqual({ ok: true, data: "2026-11-06" });
    expect(dataPagamentoDae(d(2026, 11, 9), d(2026, 11, 6)).ok).toBe(false);
  });

  it("valida o código de barras (44 a 48 números)", () => {
    expect(codigoBarrasValido("85810000002-2 22890385261-1 06202611300-0 00000000001-5")).toBe("858100000022228903852611062026113000000000000015");
    expect(codigoBarrasValido("123")).toBeNull();
    expect(codigoBarrasValido("8".repeat(48))).toBe("8".repeat(48));
  });

  it("traduz a situação do pagamento no Inter", () => {
    expect(statusPorSituacaoInter("REALIZADO")).toBe("PAGO");
    expect(statusPorSituacaoInter("AGUARDANDO_APROVACAO")).toBe("AGUARDANDO_APROVACAO");
    expect(statusPorSituacaoInter("AGENDADO")).toBe("AGENDADO");
    expect(statusPorSituacaoInter("REPROVADO")).toBe("FALHA");
    expect(statusPorSituacaoInter("AGENDADO_CANCELADO")).toBe("CANCELADO");
  });
});
