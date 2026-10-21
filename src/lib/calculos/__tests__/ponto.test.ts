import { describe, expect, it } from "vitest";
import { agruparJornadas, calcularDia, consolidarMes, data, instanteLocal, partesLocais, type ConfigJornada } from "..";

const integral: ConfigJornada = {
  regime: "INTEGRAL",
  horasSemanais: 44,
  jornada: { seg: 8, ter: 8, qua: 8, qui: 8, sex: 8, sab: 4 },
  horarios: { seg: { entrada: "08:00", saida: "17:00" } },
};
const seg = data(2026, 3, 2);
const m = (dia: Date, ...horas: string[]) => horas.map((h) => instanteLocal(dia, h));

describe("fuso horário", () => {
  it("converte instante UTC para horário de Brasília", () => {
    const i = instanteLocal(seg, "08:00");
    expect(i.toISOString()).toBe("2026-03-02T11:00:00.000Z");
    expect(partesLocais(i).hora).toBe("08:00");
    expect(partesLocais(i).data).toEqual(seg);
  });
});

describe("cálculo diário do ponto", () => {
  it("jornada normal sem extras", () => {
    const r = calcularDia({ data: seg, marcacoes: m(seg, "08:00", "12:00", "13:00", "17:00"), config: integral });
    expect(r.trabalhadoReal).toBe(480);
    expect(r.extras50).toBe(0);
    expect(r.atraso).toBe(0);
    expect(r.intervalo).toBe(60);
    expect(r.inconsistencias).toEqual([]);
  });

  it("tolerância de 5 min por marcação e 10 min no dia (CLT art. 58, § 1º)", () => {
    const r = calcularDia({ data: seg, marcacoes: m(seg, "08:04", "12:00", "13:00", "17:05"), config: integral });
    expect(r.extras50).toBe(0);
    expect(r.atraso).toBe(0);
    const r2 = calcularDia({ data: seg, marcacoes: m(seg, "08:06", "12:00", "13:00", "17:00"), config: integral });
    expect(r2.atraso).toBe(6);
  });

  it("hora extra além da jornada", () => {
    const r = calcularDia({ data: seg, marcacoes: m(seg, "08:00", "12:00", "13:00", "18:30"), config: integral });
    expect(r.extras50).toBe(90);
  });

  it("intervalo menor que 1h em jornada acima de 6h", () => {
    const r = calcularDia({ data: seg, marcacoes: m(seg, "08:00", "12:00", "12:30", "16:30"), config: integral });
    expect(r.intervaloSuprimido).toBe(30);
    const comAcordo = calcularDia({ data: seg, marcacoes: m(seg, "08:00", "12:00", "12:30", "16:30"), config: { ...integral, acordoIntervaloReduzido: true } });
    expect(comAcordo.intervaloSuprimido).toBe(0);
  });

  it("domingo trabalhado sem compensação é pago em dobro", () => {
    const dom = data(2026, 3, 8);
    const r = calcularDia({ data: dom, marcacoes: m(dom, "08:00", "12:00"), config: integral });
    expect(r.extras100).toBe(240);
    expect(r.domingoOuFeriado).toBe(true);
  });

  it("falta e falta abonada", () => {
    expect(calcularDia({ data: seg, marcacoes: [], config: integral }).falta).toBe(true);
    const ab = calcularDia({ data: seg, marcacoes: [], config: integral, abonado: true });
    expect(ab.falta).toBe(false);
    expect(ab.faltaJustificada).toBe(true);
  });

  it("trabalho noturno com hora reduzida (12x36 das 19h às 7h)", () => {
    const cfg: ConfigJornada = { regime: "DOZE_X_TRINTA_SEIS", horasSemanais: 42, jornada: {}, acordoIntervaloReduzido: true };
    const dia = data(2026, 3, 3);
    const marc = [instanteLocal(dia, "19:00"), instanteLocal(dia, "23:00"), instanteLocal(dia, "23:30"), instanteLocal(data(2026, 3, 4), "07:00")];
    const r = calcularDia({ data: dia, marcacoes: marc, config: cfg, previstoMinutos: 720 });
    expect(r.trabalhadoReal).toBe(690);
    // 22h-23h (60) + 23:30-05:00 (330) = 390 min reais noturnos → 445,71 min
    expect(r.noturnoReal).toBe(390);
    expect(r.noturnoConvertido).toBe(445.71);
    expect(r.trabalhadoComputado).toBe(746);
    expect(r.extras50).toBe(26);
  });

  it("tempo parcial acima de 6h gera inconsistência", () => {
    const cfg: ConfigJornada = { regime: "PARCIAL", horasSemanais: 22, jornada: { seg: 5, qua: 5, sex: 5, ter: 3.5, qui: 3.5 } };
    const r = calcularDia({ data: seg, marcacoes: m(seg, "08:00", "12:00", "12:15", "15:30"), config: cfg });
    expect(r.inconsistencias.some((i) => i.includes("6h"))).toBe(true);
  });

  it("marcações ímpares e interjornada menor que 11h", () => {
    const r = calcularDia({ data: seg, marcacoes: m(seg, "08:00", "12:00", "13:00"), config: integral, ultimaSaidaAnterior: instanteLocal(data(2026, 3, 1), "23:00") });
    expect(r.inconsistencias.some((i) => i.includes("ímpar"))).toBe(true);
    expect(r.inconsistencias.some((i) => i.includes("11h"))).toBe(true);
  });
});

describe("agrupamento e consolidação", () => {
  it("jornada noturna que atravessa a meia-noite fica em um único dia", () => {
    const g = agruparJornadas([
      instanteLocal(data(2026, 3, 3), "19:00"),
      instanteLocal(data(2026, 3, 4), "07:00"),
      instanteLocal(data(2026, 3, 5), "19:00"),
      instanteLocal(data(2026, 3, 6), "07:00"),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0].data).toEqual(data(2026, 3, 3));
  });

  it("banco de horas: compensa atrasos, paga até 40h e guarda o excedente", () => {
    const dias = [
      { ...calcularDia({ data: seg, marcacoes: m(seg, "08:00", "12:00", "13:00", "17:00"), config: integral }), extras50: 3000, atraso: 60 },
    ];
    const semAcordo = consolidarMes(dias, integral);
    expect(semAcordo.extrasPagas50).toBe(3000);
    expect(semAcordo.atrasoDescontado).toBe(60);
    const comAcordo = consolidarMes(dias, { ...integral, acordoCompensacao: true });
    expect(comAcordo.compensado).toBe(60);
    expect(comAcordo.extrasPagas50).toBe(2400);
    expect(comAcordo.paraBanco).toBe(540);
    expect(comAcordo.atrasoDescontado).toBe(0);
  });
});
