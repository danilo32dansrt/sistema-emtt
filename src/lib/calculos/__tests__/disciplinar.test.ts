import { describe, expect, it } from "vitest";
import { checarProporcionalidade, data, periodoSuspensao, recomendarMedida, riscoDisciplinar } from "..";

const hoje = data(2026, 10, 21);
const base = { dataFato: data(2026, 10, 20), dataCiencia: data(2026, 10, 20), hoje, historico: [] };

describe("recomendação disciplinar (gradação)", () => {
  it("primeira falta leve: orientação verbal", () => {
    expect(recomendarMedida({ ...base, tipoFalta: "ATRASO" }).medida).toBe("ORIENTACAO_VERBAL");
  });
  it("falta leve após orientação: advertência; após advertência: suspensão de 1 dia", () => {
    const h1 = [{ data: data(2026, 8, 1), tipoFalta: "ATRASO", medida: "ORIENTACAO_VERBAL" as const }];
    expect(recomendarMedida({ ...base, tipoFalta: "ATRASO", historico: h1 }).medida).toBe("ADVERTENCIA_ESCRITA");
    const h2 = [...h1, { data: data(2026, 9, 1), tipoFalta: "ATRASO", medida: "ADVERTENCIA_ESCRITA" as const }];
    const r = recomendarMedida({ ...base, tipoFalta: "ATRASO", historico: h2 });
    expect(r.medida).toBe("SUSPENSAO");
    expect(r.diasSuspensao).toBe(1);
  });
  it("faltas leves repetidas após 2 suspensões: encaminhar ao consultor", () => {
    const h = [
      { data: data(2026, 5, 1), tipoFalta: "ATRASO", medida: "SUSPENSAO" as const },
      { data: data(2026, 7, 1), tipoFalta: "ATRASO", medida: "SUSPENSAO" as const },
    ];
    expect(recomendarMedida({ ...base, tipoFalta: "ATRASO", historico: h }).medida).toBe("JUSTA_CAUSA");
  });
  it("medidas com mais de 12 meses pesam menos", () => {
    const h = [{ data: data(2025, 1, 1), tipoFalta: "ATRASO", medida: "ADVERTENCIA_ESCRITA" as const }];
    expect(recomendarMedida({ ...base, tipoFalta: "ATRASO", historico: h }).medida).toBe("ORIENTACAO_VERBAL");
  });
  it("falta média: advertência; grave: suspensão; gravíssima: consultor", () => {
    expect(recomendarMedida({ ...base, tipoFalta: "NEGLIGENCIA" }).medida).toBe("ADVERTENCIA_ESCRITA");
    const g = recomendarMedida({ ...base, tipoFalta: "INSUBORDINACAO" });
    expect(g.medida).toBe("SUSPENSAO");
    expect(g.diasSuspensao).toBe(3);
    expect(recomendarMedida({ ...base, tipoFalta: "IMPROBIDADE" }).medida).toBe("JUSTA_CAUSA");
  });
});

describe("checagens de segurança", () => {
  it("imediatidade: avisa após 10 dias e alerta perdão tácito após 30", () => {
    expect(recomendarMedida({ ...base, tipoFalta: "ATRASO", dataFato: data(2026, 10, 1), dataCiencia: data(2026, 10, 5) }).checagens[0].tipo).toBe("aviso");
    const r = recomendarMedida({ ...base, tipoFalta: "ATRASO", dataFato: data(2026, 8, 1), dataCiencia: data(2026, 8, 1) });
    expect(r.checagens.some((c) => c.tipo === "critico" && c.mensagem.includes("perdão tácito"))).toBe(true);
  });
  it("bloqueia punição dupla, afastamento e abandono com menos de 30 dias", () => {
    expect(recomendarMedida({ ...base, tipoFalta: "ATRASO", jaPunida: true }).bloqueado).toBe(true);
    expect(recomendarMedida({ ...base, tipoFalta: "ATRASO", afastado: true }).bloqueado).toBe(true);
    expect(recomendarMedida({ ...base, tipoFalta: "ABANDONO", diasAusencia: 20 }).bloqueado).toBe(true);
    expect(recomendarMedida({ ...base, tipoFalta: "ABANDONO", diasAusencia: 31 }).bloqueado).toBe(false);
  });
  it("alerta estabilidade e risco de rescisão indireta", () => {
    const r = recomendarMedida({ ...base, tipoFalta: "IMPROBIDADE", estabilidade: { motivo: "gestante", ate: data(2027, 5, 1) }, pendenciasEmpregador: ["DAE atrasado"] });
    expect(r.checagens.filter((c) => c.tipo === "critico")).toHaveLength(2);
  });
  it("proporcionalidade e limite de 30 dias de suspensão", () => {
    expect(checarProporcionalidade("SUSPENSAO", "ORIENTACAO_VERBAL", 3).some((c) => c.tipo === "critico")).toBe(true);
    expect(checarProporcionalidade("SUSPENSAO", "SUSPENSAO", 31).some((c) => c.tipo === "bloqueio")).toBe(true);
    expect(checarProporcionalidade("ADVERTENCIA_ESCRITA", "ADVERTENCIA_ESCRITA")).toEqual([]);
  });
});

describe("risco e suspensão", () => {
  it("pontuação de risco", () => {
    expect(riscoDisciplinar([], hoje).nivel).toBe("baixo");
    expect(riscoDisciplinar([{ data: data(2026, 9, 1), gravidade: "grave" }, { data: data(2026, 10, 1), gravidade: "media" }], hoje).nivel).toBe("medio");
    expect(riscoDisciplinar([{ data: data(2026, 9, 1), gravidade: "gravissima" }, { data: data(2026, 10, 1), gravidade: "media" }], hoje).nivel).toBe("alto");
  });
  it("divide os dias de suspensão por mês", () => {
    const p = periodoSuspensao(data(2026, 10, 30), 3);
    expect(p.retorno).toEqual(data(2026, 11, 2));
    expect(p.porMes).toEqual([{ ano: 2026, mes: 10, dias: 2 }, { ano: 2026, mes: 11, dias: 1 }]);
  });
});
