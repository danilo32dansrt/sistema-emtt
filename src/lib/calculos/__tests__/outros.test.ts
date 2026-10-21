import { describe, expect, it } from "vitest";
import {
  acrescimosAtraso, calcularRegularizacao, compararModelos, competenciasEntre, data, diagnosticarCliente, gerarAgenda,
  prazosChecklist, simularCustoContratacao, simularHoraExtra, simularReajuste, situacaoChecklist, TABELAS_PADRAO, validarEmpregado,
} from "..";

const t = TABELAS_PADRAO[2026];

describe("regularização", () => {
  it("multa de 0,33% ao dia limitada a 20%", () => {
    const a = acrescimosAtraso(100, data(2026, 3, 6), data(2026, 4, 6), 1);
    expect(a.dias).toBe(31);
    expect(a.percMulta).toBe(10.23);
    expect(a.percJuros).toBe(1);
    expect(a.total).toBe(111.23);
    const b = acrescimosAtraso(100, data(2026, 3, 6), data(2026, 9, 6), 1);
    expect(b.percMulta).toBe(20);
    expect(b.percJuros).toBe(6);
    expect(acrescimosAtraso(100, data(2026, 3, 6), data(2026, 3, 6), 1).total).toBe(100);
  });

  it("estima DAEs atrasados de vários meses", () => {
    const r = calcularRegularizacao({ competencias: competenciasEntre(data(2025, 11, 1), data(2026, 1, 1), 1621), dataPagamento: data(2026, 4, 15), tabelas: TABELAS_PADRAO, selicMensal: 1 });
    expect(r.linhas).toHaveLength(3);
    expect(r.linhas[0].competencia).toBe("11/2025");
    expect(r.linhas[0].percMulta).toBe(20);
    expect(r.totais.total).toBeGreaterThan(r.totais.principal);
  });
});

describe("validações do cadastro", () => {
  it("salário abaixo do mínimo proporcional", () => {
    const a = validarEmpregado({ salario: 800, regime: "PARCIAL", jornada: { seg: 5, ter: 4, qua: 5, qui: 4, sex: 4 }, admissao: data(2026, 2, 9), salarioMinimo: 1621 });
    expect(a.map((x) => x.codigo)).toContain("SALARIO_ABAIXO_MINIMO");
  });
  it("parcial acima de 25h ou 6h diárias", () => {
    const a = validarEmpregado({ salario: 2000, regime: "PARCIAL", jornada: { seg: 7, ter: 7, qua: 7, qui: 7 }, admissao: data(2026, 2, 9), salarioMinimo: 1621 });
    expect(a.map((x) => x.codigo)).toEqual(expect.arrayContaining(["PARCIAL_SEMANAL", "PARCIAL_DIARIA"]));
  });
  it("2 dias ou menos por semana caracteriza diarista", () => {
    const a = validarEmpregado({ salario: 1621, regime: "INTEGRAL", jornada: { seg: 8, qua: 8 }, admissao: data(2026, 2, 9), salarioMinimo: 1621 });
    expect(a.map((x) => x.codigo)).toContain("DIARISTA");
  });
  it("12x36 sem acordo, menor de idade e experiência acima de 90 dias", () => {
    const a = validarEmpregado({ salario: 1621, regime: "DOZE_X_TRINTA_SEIS", jornada: { seg: 12, qua: 12, sex: 12 }, admissao: data(2026, 2, 9), nascimento: data(2010, 1, 1), salarioMinimo: 1621, diasExperiencia: 120 });
    expect(a.map((x) => x.codigo)).toEqual(expect.arrayContaining(["SEM_ACORDO_12X36", "MENOR_DE_IDADE", "EXPERIENCIA_LONGA"]));
  });
  it("cadastro regular não gera alertas críticos", () => {
    const a = validarEmpregado({ salario: 810.5, regime: "PARCIAL", jornada: { seg: 4.4, ter: 4.4, qua: 4.4, qui: 4.4, sex: 4.4 }, admissao: data(2026, 2, 9), salarioMinimo: 1621, cpf: "529.982.247-25" });
    expect(a.filter((x) => x.severidade === "critico")).toEqual([]);
  });
});

describe("checklist mensal", () => {
  it("prazos e atraso", () => {
    const p = prazosChecklist(2026, 2);
    expect(p.infoRecebida).toEqual(data(2026, 2, 28));
    expect(p.daeEmitido).toEqual(data(2026, 3, 4));
    expect(p.pagamentoConfirmado).toEqual(data(2026, 3, 6));
    const s = situacaoChecklist(2026, 2, { infoRecebida: true }, data(2026, 3, 10));
    expect(s.status).toBe("atrasado");
    expect(s.atrasadas).toContain("pagamentoConfirmado");
    const ok = situacaoChecklist(2026, 2, { infoRecebida: true, folhaLancada: true, folhaEncerrada: true, daeEmitido: true, daeEnviado: true, pagamentoConfirmado: true, reciboArquivado: true }, data(2026, 3, 10));
    expect(ok.status).toBe("ok");
    expect(situacaoChecklist(2026, 3, {}, data(2026, 3, 10)).status).toBe("pendente");
  });
});

describe("agenda de alertas", () => {
  it("gera DAE, 13º, férias, experiência e procuração", () => {
    const ev = gerarAgenda({
      hoje: data(2026, 3, 1),
      de: data(2026, 3, 1),
      ate: data(2027, 12, 31),
      clientes: [{ id: "c1", nome: "Suely", procuracaoValidade: data(2026, 8, 31), temEmpregadoAtivo: true }],
      empregados: [{ id: "e1", nome: "Maria", clienteId: "c1", clienteNome: "Suely", admissao: data(2026, 2, 9), ativo: true, diasExperiencia: 45, feriasGozadas: [], feriasProgramadas: [{ inicio: data(2027, 3, 1), dias: 30 }] }],
    });
    const tipos = new Set(ev.map((e) => e.tipo));
    for (const tipo of ["DAE_MENSAL", "DECIMO_PRIMEIRA", "DECIMO_SEGUNDA", "FERIAS_AQUISITIVO", "FERIAS_AVISO", "FERIAS_PAGAMENTO", "EXPERIENCIA_FIM", "PROCURACAO", "ANIVERSARIO_ADMISSAO", "REAJUSTE_ANUAL"]) {
      expect(tipos, tipo).toContain(tipo);
    }
    const dae = ev.find((e) => e.tipo === "DAE_MENSAL")!;
    expect(dae.data).toEqual(data(2026, 3, 6));
    expect(ev.find((e) => e.tipo === "EXPERIENCIA_FIM")!.data).toEqual(data(2026, 3, 25));
    // datas em ordem
    expect(ev.every((e, i) => i === 0 || ev[i - 1].data.getTime() <= e.data.getTime())).toBe(true);
  });
});

describe("simuladores", () => {
  it("custo total de contratar", () => {
    const c = simularCustoContratacao({ salario: 1621, horasSemanais: 44, tabela: t });
    expect(c.mensal.encargos).toBe(324.19);
    expect(c.mensal.provisao13).toBe(135.08);
    expect(c.mensal.provisaoFerias).toBe(180.11);
    expect(c.mensal.total).toBeGreaterThan(2300);
    expect(c.anual.total).toBeGreaterThan(c.mensal.salario * 13);
  });
  it("comparador de modelos", () => {
    const r = compararModelos({ tabela: t, diarista: { valorDiaria: 180, diasPorSemana: 3 }, parcial: { salario: 700, horasSemanais: 22 }, integral: { salario: 1621 } });
    expect(r).toHaveLength(3);
    expect(r[0].alerta).toMatch(/vínculo/);
    expect(r[1].alerta).toMatch(/mínimo proporcional/);
  });
  it("reajuste e hora extra", () => {
    const r = simularReajuste({ salarioAtual: 1518, salarioNovo: 1621, horasSemanais: 44, tabelaAtual: TABELAS_PADRAO[2025], tabelaNova: t });
    expect(r.percentual).toBe(6.79);
    expect(r.diferencaMensal).toBeGreaterThan(103);
    const h = simularHoraExtra({ salario: 1621, horasSemanais: 44, horasExtras: 2, tabela: t });
    expect(h.extras).toBe(22.1);
    expect(h.total).toBeGreaterThan(h.extras);
  });
});

describe("diagnóstico de riscos", () => {
  it("nota de conformidade", () => {
    const ok = diagnosticarCliente({ procuracaoStatus: "ATIVA", procuracaoVenceEmDias: 200, folhasNaoEncerradas: 0, daesAtrasados: 0, mensalidadesAtrasadas: 0, empregados: [] });
    expect(ok.nota).toBe(100);
    const ruim = diagnosticarCliente({
      procuracaoStatus: "VENCIDA", procuracaoVenceEmDias: null, folhasNaoEncerradas: 1, daesAtrasados: 2, mensalidadesAtrasadas: 0,
      empregados: [{ nome: "Maria", validacoes: [], feriasVencidas: 1, feriasVencendo60dias: 0, espelhoAssinadoMesAnterior: false, regime: "INTEGRAL", acordoCompensacaoNecessario: false, temAcordoCompensacao: false, acordo12x36Necessario: false, temAcordo12x36: false, temContratoAssinado: false }],
    });
    expect(ruim.nota).toBe(31);
    expect(ruim.classificacao).toBe("Crítico");
    expect(ruim.itens[0].peso).toBe(20);
  });
});
