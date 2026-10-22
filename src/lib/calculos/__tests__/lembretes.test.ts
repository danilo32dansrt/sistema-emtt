import { describe, expect, it } from "vitest";
import { data, entradasPossiveis, instanteLocal, instantesDoDia, intervaloMinimo, lembretesEscala, saidaDaEscala, lembretesCobrancaPlus, lembretesFechamento, marcacaoQueFalta, marcacoesDoContrato, lembretesConsultor, lembretesDae, lembretesPedidosPendentes, lembretesPonto, type DiaPonto } from "..";

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

describe("plano Plus — cobrança do mês", () => {
  const venc = data(2026, 11, 5);
  const em = (d: Date, h: string) => lembretesCobrancaPlus({ agora: instanteLocal(d, h), vencimento: venc, total: "R$ 372,89" }).map((l) => l.titulo);
  it("lembra na véspera, no dia e depois, a cada hora em horário comercial", () => {
    expect(em(data(2026, 11, 3), "10:00")).toEqual([]);
    expect(em(data(2026, 11, 4), "10:00")).toEqual(["Amanhã vence a cobrança do mês"]);
    expect(em(data(2026, 11, 5), "10:00")).toEqual(["Hoje vence a cobrança do mês"]);
    expect(em(data(2026, 11, 6), "10:00")).toEqual(["Cobrança do mês em atraso"]);
    expect(em(data(2026, 11, 6), "22:00")).toEqual([]);
  });
});

describe("ações de um toque", () => {
  it("horário do contrato com intervalo no meio da jornada", () => {
    expect(marcacoesDoContrato("08:00", "17:00", 480)).toEqual(["08:00", "12:00", "13:00", "17:00"]);
    expect(marcacoesDoContrato("08:00", "12:24", 264)).toEqual(["08:00", "10:10", "10:25", "12:24"]);
    expect(marcacoesDoContrato("08:00", "12:00", 240)).toEqual(["08:00", "12:00"]);
    expect(marcacoesDoContrato("19:00", "07:00", 660)).toEqual(["19:00", "00:30", "01:30", "07:00"]);
  });
  it("marcação que falta num dia incompleto é a saída do contrato", () => {
    expect(marcacaoQueFalta([480, 720, 780], "17:00")).toBe("17:00");
    expect(marcacaoQueFalta([480, 720], "17:00")).toBeNull();
    expect(marcacaoQueFalta([480, 1100], "17:00")).toBeNull();
  });
  it("lembra de fechar o mês do dia 1º até o prazo, até confirmar", () => {
    const base = { competencia: "10/2026", diaLimite: 3, nome: "Maria Exemplo", resumo: "Sem faltas, 2h extras." };
    expect(lembretesFechamento({ ...base, agora: instanteLocal(data(2026, 11, 2), "10:00"), fechado: false })[0].titulo).toBe("Feche o ponto de 10/2026 — Maria");
    expect(lembretesFechamento({ ...base, agora: instanteLocal(data(2026, 11, 2), "10:00"), fechado: true })).toEqual([]);
    expect(lembretesFechamento({ ...base, agora: instanteLocal(data(2026, 11, 4), "10:00"), fechado: false })).toEqual([]);
  });
});

describe("turno que passa da meia-noite", () => {
  it("horas depois da meia-noite caem no dia seguinte", () => {
    const i = instantesDoDia(data(2026, 10, 20), ["22:00", "02:00", "03:00", "07:00"]);
    expect(i.map((x) => x.toISOString())).toEqual(["2026-10-21T01:00:00.000Z", "2026-10-21T05:00:00.000Z", "2026-10-21T06:00:00.000Z", "2026-10-21T10:00:00.000Z"]);
    expect(instantesDoDia(data(2026, 10, 20), ["08:00", "17:00"]).map((x) => x.toISOString())).toEqual(["2026-10-20T11:00:00.000Z", "2026-10-20T20:00:00.000Z"]);
  });
});

describe("horário flexível e limites do dia", () => {
  it("saída da escala e horários possíveis na faixa do contrato", () => {
    expect(saidaDaEscala("10:00", 360)).toBe("16:15"); // 6h + 15 min de intervalo (jornada de 4h a 6h)
    expect(saidaDaEscala("10:00", 264)).toBe("14:39");
    expect(entradasPossiveis("07:00", "19:00", 360)).toEqual(["07:00", "08:00", "09:00", "10:00", "11:00", "12:00"]);
  });

  it("pergunta ao patrão à tarde, a cada hora, até ele escolher; depois avisa a empregada", () => {
    const amanha = { data: data(2026, 3, 5), diaDeTrabalho: true, entrada: "08:00", saida: "12:24", definida: false };
    const titulo = (h: string, a = amanha) => lembretesEscala({ agora: instanteLocal(qua, h), nome: "Maria Exemplo", amanha: a }).map((l) => `${l.para}:${l.titulo}`);
    expect(titulo("15:00")).toEqual([]);
    expect(titulo("17:10")).toEqual(["EMPREGADOR:Qual horário Maria entra amanhã (05/03)?"]);
    expect(titulo("21:30")).toEqual([]);
    expect(titulo("17:10", { ...amanha, entrada: "10:00", saida: "16:15", definida: true })).toEqual(["EMPREGADO:Amanhã (05/03) você entra às 10:00"]);
  });

  it("avisa 30 e 10 minutos antes da saída", () => {
    const d = dia(qua, ["10:00"], { previstoMinutos: 360, entradaPrevista: "10:00", saidaPrevista: "16:15" });
    expect(chaves("15:46", d)).toEqual(["EMPREGADO:saida-30"]);
    expect(chaves("16:06", d)).toEqual(["EMPREGADO:saida-10"]);
  });

  it("tempo parcial com 6h no dia: não permite hora extra", () => {
    const d = dia(qua, ["10:00", "13:00", "13:15"], { previstoMinutos: 360, entradaPrevista: "10:00", saidaPrevista: "16:15" });
    const l = lembretesPonto({ agora: instanteLocal(qua, "16:35"), nome: "Maria", hoje: d, limiteExtraMinutos: 60, limiteDiaMinutos: 360, regraLimite: "tempo parcial: até 6h no dia" });
    expect(l.find((x) => x.chave.startsWith("saida:"))!.texto).toContain("Hoje não é permitida hora extra");
    expect(l.map((x) => x.chave.split(":")[0])).toContain("limite-patrao");
  });

  it("tempo parcial com 4h24: pode ficar até 1h a mais, com aviso 10 min antes do limite", () => {
    const d = dia(qua, ["08:00", "10:10", "10:25"], { previstoMinutos: 264, entradaPrevista: "08:00", saidaPrevista: "12:39" });
    const em = (h: string) => lembretesPonto({ agora: instanteLocal(qua, h), nome: "Maria", hoje: d, limiteExtraMinutos: 60, limiteDiaMinutos: 360 });
    expect(em("12:55").find((x) => x.chave.startsWith("saida:"))!.texto).toContain("até no máximo 13:39");
    expect(em("13:31").map((x) => x.chave.split(":")[0])).toContain("limite-10");
  });
});
