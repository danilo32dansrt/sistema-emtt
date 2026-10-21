import { describe, expect, it } from "vitest";
import { data, instanteLocal, intervaloMinimo, lembretesConsultor, lembretesDae, lembretesPedidosPendentes, lembretesPonto, type DiaPonto } from "..";

const qua = data(2026, 3, 4);
const ter = data(2026, 3, 3);
const dia = (d: Date, marcacoes: string[], extra: Partial<DiaPonto> = {}): DiaPonto => ({
  data: d, diaDeTrabalho: true, previstoMinutos: 480, entradaPrevista: "08:00", saidaPrevista: "17:00", marcacoes: marcacoes.map((h) => instanteLocal(d, h)), ...extra,
});
const chaves = (agora: string, hoje: DiaPonto, ontem?: DiaPonto) =>
  lembretesPonto({ agora: instanteLocal(qua, agora), nome: "Maria Exemplo", hoje, anteriores: ontem ? [ontem] : [] }).map((l) => `${l.para}:${l.chave.split(":")[0]}`);

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

  it("dia anterior sem marcação ou incompleto avisa os dois, em horário comercial", () => {
    const hojeFolga = dia(qua, [], { diaDeTrabalho: false });
    expect(chaves("08:00", hojeFolga, dia(ter, []))).toEqual(["EMPREGADO:dia-sem", "EMPREGADOR:dia-sem"]);
    expect(chaves("08:00", hojeFolga, dia(ter, ["08:00", "12:00", "13:00"]))).toEqual(["EMPREGADO:dia-incompleto", "EMPREGADOR:dia-incompleto"]);
    expect(chaves("06:00", hojeFolga, dia(ter, []))).toEqual([]);
    expect(chaves("21:00", hojeFolga, dia(ter, []))).toEqual([]);
  });

  it("enquanto a pendência continuar, o lembrete se repete a cada hora (chave muda de hora em hora)", () => {
    const pendente = dia(qua, []);
    const em = (h: string) => lembretesPonto({ agora: instanteLocal(qua, h), nome: "Maria", hoje: pendente }).find((l) => l.para === "EMPREGADO")!;
    expect(em("08:20").chave).toBe(em("08:50").chave);
    expect(em("08:20").chave).not.toBe(em("09:20").chave);
    expect(em("10:00").titulo).toBe("A entrada de hoje ainda não foi lançada");
    expect(em("10:00").acao).toBe("Marcar entrada agora");
    // Até o fim do horário previsto; depois vira pendência do dia
    expect(lembretesPonto({ agora: instanteLocal(qua, "17:30"), nome: "Maria", hoje: pendente })).toEqual([]);
  });

  it("saída não lançada continua lembrando até a meia-noite", () => {
    expect(chaves("20:30", dia(qua, ["08:00", "12:00", "13:00"]))).toEqual(["EMPREGADO:saida"]);
  });
});

describe("pedidos esperando o patrão", () => {
  it("lembra a cada hora em horário comercial enquanto houver pedido pendente", () => {
    expect(lembretesPedidosPendentes({ agora: instanteLocal(qua, "10:00"), pendentes: 2 })[0].titulo).toBe("2 pedido(s) de ponto esperando você");
    expect(lembretesPedidosPendentes({ agora: instanteLocal(qua, "10:00"), pendentes: 0 })).toEqual([]);
    expect(lembretesPedidosPendentes({ agora: instanteLocal(qua, "22:00"), pendentes: 2 })).toEqual([]);
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

describe("lembretes do consultor", () => {
  const base = { diaEmissaoGuias: 4, vencimentoDae: data(2026, 4, 7), competencia: "03/2026", daesParaEmitir: 0, pagamentosAConfirmar: 0, rotinaAtrasada: 0, pedidosPonto: 0, mensagensNaoLidas: 0, justaCausaParaRevisar: 0, procuracoesVencendo: 0, mensalidadesAtrasadas: 0, parametrosParaConferir: 0 };
  const em = (d: Date, h: string, extra: object) => lembretesConsultor({ ...base, ...extra, agora: instanteLocal(d, h) }).map((l) => l.chave.split(":")[0]);
  it("resumo do dia e urgência de emitir as guias até o dia 4", () => {
    expect(em(data(2026, 4, 2), "09:00", { daesParaEmitir: 3 })).toEqual(["resumo"]);
    expect(em(data(2026, 4, 3), "09:00", { daesParaEmitir: 3 })).toEqual(["resumo", "emitir"]);
    expect(em(data(2026, 4, 4), "09:00", { daesParaEmitir: 3 })).toEqual(["resumo", "emitir"]);
  });
  it("DAE vencendo sem pagamento confirmado e justa causa repetem a cada hora", () => {
    expect(em(data(2026, 4, 7), "10:00", { pagamentosAConfirmar: 2, justaCausaParaRevisar: 1 })).toEqual(["resumo", "confirmar", "justa-causa"]);
    const a = lembretesConsultor({ ...base, justaCausaParaRevisar: 1, agora: instanteLocal(data(2026, 4, 7), "10:00") })[1].chave;
    const b = lembretesConsultor({ ...base, justaCausaParaRevisar: 1, agora: instanteLocal(data(2026, 4, 7), "11:00") })[1].chave;
    expect(a).not.toBe(b);
  });
  it("nada fora do horário comercial e nada sem pendência", () => {
    expect(em(data(2026, 4, 7), "22:00", { daesParaEmitir: 3 })).toEqual([]);
    expect(em(data(2026, 4, 7), "10:00", {})).toEqual([]);
  });
});
