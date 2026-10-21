import { describe, expect, it } from "vitest";
import { calcularRescisao, data, diasAvisoPrevio, TABELAS_PADRAO } from "..";

const t = TABELAS_PADRAO[2026];
const base = {
  admissao: data(2023, 3, 1),
  desligamento: data(2026, 6, 15),
  salario: 1621,
  horasSemanais: 44,
  tabela: t,
  feriasGozadas: [
    { inicioAquisitivo: data(2023, 3, 1), dias: 30 },
    { inicioAquisitivo: data(2024, 3, 1), dias: 30 },
  ],
};
const verba = (r: ReturnType<typeof calcularRescisao>, inicio: string) => r.verbas.find((v) => v.descricao.startsWith(inicio))?.valor;

describe("aviso prévio proporcional", () => {
  it("30 dias + 3 por ano completo, máximo 90", () => {
    expect(diasAvisoPrevio(data(2026, 1, 1), data(2026, 6, 1))).toBe(30);
    expect(diasAvisoPrevio(data(2023, 3, 1), data(2026, 6, 15))).toBe(39);
    expect(diasAvisoPrevio(data(2000, 1, 1), data(2026, 6, 1))).toBe(90);
  });
});

describe("rescisão", () => {
  it("dispensa sem justa causa com aviso indenizado", () => {
    const r = calcularRescisao({ ...base, tipo: "SEM_JUSTA_CAUSA" });
    expect(r.bloqueio).toBeNull();
    expect(r.diasAviso).toBe(39);
    expect(r.dataProjetada).toEqual(data(2026, 7, 24));
    expect(verba(r, "Saldo de salário")).toBe(810.5);
    expect(verba(r, "Aviso prévio indenizado")).toBe(2107.3);
    expect(verba(r, "13º salário proporcional (7/12)")).toBe(945.58);
    expect(verba(r, "Férias vencidas (")).toBe(1621);
    expect(verba(r, "Férias proporcionais (5/12)")).toBe(675.42);
    expect(verba(r, "1/3 sobre férias proporcionais")).toBe(225.14);
    expect(verba(r, "INSS sobre saldo")).toBe(60.78);
    expect(verba(r, "INSS sobre 13º")).toBe(70.91);
    expect(r.fgts.paraEmpregado).toBeGreaterThan(0);
    expect(r.fgts.paraEmpregador).toBe(0);
    expect(r.prazoPagamento).toEqual(data(2026, 6, 25));
    // FGTS incide sobre saldo + aviso + 13º
    expect(r.dae.fgts).toBe(309.07);
  });

  it("pedido de demissão: sem aviso indenizado e compensatório volta ao empregador", () => {
    const r = calcularRescisao({ ...base, tipo: "PEDIDO_DEMISSAO", avisoPrevio: "TRABALHADO" });
    expect(verba(r, "Aviso prévio indenizado")).toBeUndefined();
    expect(r.fgts.paraEmpregado).toBe(0);
    expect(r.fgts.paraEmpregador).toBeGreaterThan(0);
    expect(r.fgts.saque).toMatch(/não pode sacar/);
    expect(verba(r, "13º salário proporcional (6/12)")).toBe(810.5);
  });

  it("pedido de demissão sem cumprir aviso desconta 30 dias", () => {
    const r = calcularRescisao({ ...base, tipo: "PEDIDO_DEMISSAO", avisoPrevio: "NAO_CUMPRIDO" });
    expect(verba(r, "Desconto do aviso")).toBe(1621);
  });

  it("justa causa: só saldo e férias vencidas", () => {
    const r = calcularRescisao({ ...base, tipo: "JUSTA_CAUSA" });
    expect(verba(r, "13º")).toBeUndefined();
    expect(verba(r, "Férias proporcionais")).toBeUndefined();
    expect(verba(r, "Férias vencidas (")).toBe(1621);
  });

  it("acordo: metade do aviso e do compensatório, saque de 80%", () => {
    const r = calcularRescisao({ ...base, tipo: "ACORDO", saldoFgts: 1000, fgtsCompensatorioAcumulado: 400 });
    expect(verba(r, "Aviso prévio indenizado")).toBe(1053.65);
    expect(r.fgts.paraEmpregado).toBe(200);
    expect(r.fgts.paraEmpregador).toBe(200);
    expect(r.fgts.saqueFgts).toBe(800);
  });

  it("férias vencidas fora do concessivo são pagas em dobro", () => {
    const r = calcularRescisao({ ...base, feriasGozadas: [], tipo: "SEM_JUSTA_CAUSA" });
    expect(verba(r, "Férias vencidas em dobro")).toBe(3242);
    expect(r.alertas.some((a) => a.includes("dobro"))).toBe(true);
  });

  it("bloqueia dispensa sem justa causa de gestante com estabilidade", () => {
    const r = calcularRescisao({ ...base, tipo: "SEM_JUSTA_CAUSA", estabilidade: { motivo: "gestante", ate: data(2027, 1, 1) } });
    expect(r.bloqueio).toMatch(/estabilidade/);
  });

  it("término da experiência e encerramento antecipado (art. 479)", () => {
    const exp = { ...base, admissao: data(2026, 5, 1), desligamento: data(2026, 7, 29), feriasGozadas: [] };
    const termino = calcularRescisao({ ...exp, tipo: "TERMINO_CONTRATO" });
    expect(termino.diasAviso).toBe(0);
    expect(termino.fgts.saque).toMatch(/pode sacar/);
    const antecipada = calcularRescisao({ ...exp, desligamento: data(2026, 6, 30), fimExperiencia: data(2026, 7, 29), tipo: "ANTECIPADA_EXPERIENCIA_EMPREGADOR" });
    expect(verba(antecipada, "Indenização art. 479")).toBe(783.48);
  });

  it("banco de horas pago na rescisão com 50%", () => {
    const r = calcularRescisao({ ...base, tipo: "PEDIDO_DEMISSAO", saldoBancoHoras: 10 });
    expect(verba(r, "Saldo do banco de horas")).toBe(110.52);
  });
});
