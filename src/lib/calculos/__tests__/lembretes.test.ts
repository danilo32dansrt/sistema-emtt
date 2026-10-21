import { describe, expect, it } from "vitest";
import { data, instanteLocal, intervaloMinimo, lembretesDae, lembretesPonto, type DiaPonto } from "..";

const qua = data(2026, 3, 4);
const ter = data(2026, 3, 3);
const dia = (d: Date, marcacoes: string[], extra: Partial<DiaPonto> = {}): DiaPonto => ({
  data: d, diaDeTrabalho: true, previstoMinutos: 480, entradaPrevista: "08:00", saidaPrevista: "17:00", marcacoes: marcacoes.map((h) => instanteLocal(d, h)), ...extra,
});
const chaves = (agora: string, hoje: DiaPonto, ontem?: DiaPonto) =>
  lembretesPonto({ agora: instanteLocal(qua, agora), nome: "Maria Exemplo", hoje, ontem }).map((l) => `${l.para}:${l.chave.split(":")[0]}`);

describe("lembretes do ponto", () => {
  it("lembra a empregada de bater a entrada perto do horário", () => {
    expect(chaves("07:55", dia(qua, []))).toEqual(["EMPREGADO:entrada"]);
    expect(chaves("07:30", dia(qua, []))).toEqual([]);
  });

  it("avisa o patrão se ela não marcou a entrada 30 min depois", () => {
    expect(chaves("08:35", dia(qua, []))).toEqual(["EMPREGADO:entrada", "EMPREGADOR:sem-entrada"]);
  });

  it("lembra de sair e de voltar do intervalo", () => {
    expect(chaves("12:05", dia(qua, ["08:00"]))).toEqual(["EMPREGADO:intervalo"]);
    expect(chaves("13:15", dia(qua, ["08:00", "12:00"]))).toEqual(["EMPREGADO:retorno"]);
    expect(chaves("12:30", dia(qua, ["08:00", "12:00"]))).toEqual([]);
  });

  it("lembra de marcar a saída", () => {
    expect(chaves("17:20", dia(qua, ["08:00", "12:00", "13:00"]))).toEqual(["EMPREGADO:saida"]);
    expect(chaves("17:20", dia(qua, ["08:00", "12:00", "13:00", "17:00"]))).toEqual([]);
  });

  it("jornada de 4h (tempo parcial) sem intervalo obrigatório não pede intervalo", () => {
    const curta = dia(qua, ["08:00"], { previstoMinutos: 240, saidaPrevista: "12:00" });
    expect(chaves("10:30", curta)).toEqual([]);
    expect(intervaloMinimo(264)).toBe(15);
    expect(intervaloMinimo(480, true)).toBe(30);
  });

  it("folga, feriado ou dia justificado não geram lembrete do dia", () => {
    expect(chaves("08:35", dia(qua, [], { diaDeTrabalho: false }))).toEqual([]);
  });

  it("dia anterior sem marcação ou incompleto avisa os dois", () => {
    const hojeFolga = dia(qua, [], { diaDeTrabalho: false });
    expect(chaves("08:00", hojeFolga, dia(ter, []))).toEqual(["EMPREGADO:ontem-sem", "EMPREGADOR:ontem-sem"]);
    expect(chaves("08:00", hojeFolga, dia(ter, ["08:00", "12:00", "13:00"]))).toEqual(["EMPREGADO:ontem-incompleto", "EMPREGADOR:ontem-incompleto"]);
    expect(chaves("06:00", hojeFolga, dia(ter, []))).toEqual([]);
  });

  it("a chave do lembrete leva a data (não repete no mesmo dia)", () => {
    const l = lembretesPonto({ agora: instanteLocal(qua, "07:55"), nome: "Maria", hoje: dia(qua, []) });
    expect(l[0].chave).toBe("entrada:2026-03-04");
  });
});

describe("lembretes do DAE", () => {
  const venc = data(2026, 4, 7);
  const dae = (hoje: Date, pago = false) => lembretesDae({ hoje, vencimento: venc, pago, competencia: "03/2026", valor: "R$ 222,89" }).map((l) => l.titulo);
  it("3 dias antes, no dia e depois do vencimento", () => {
    expect(dae(data(2026, 4, 4))).toEqual(["DAE vence em 3 dias"]);
    expect(dae(data(2026, 4, 5))).toEqual([]);
    expect(dae(data(2026, 4, 7))).toEqual(["DAE vence hoje"]);
    expect(dae(data(2026, 4, 8))).toEqual(["DAE em atraso"]);
    expect(dae(data(2026, 4, 14))).toEqual(["DAE em atraso"]);
  });
  it("nada depois de pago", () => {
    expect(dae(data(2026, 4, 7), true)).toEqual([]);
  });
});
