import "server-only";
import type { Empregado } from "@prisma/client";
import {
  addDias, agruparJornadas, calcularDia, hojeBrasil, consolidarMes, data, diasDoMes, ehDiaDeTrabalho12x36, partesLocais, soData, ultimoDiaMes,
  valorAdicionalNoturno, valorHorasExtras, descontoFaltas, descontoAtrasos, arred, parametrosJornada, type ResultadoDia,
} from "@/lib/calculos";
import { configJornada, num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { registrosParametros } from "@/lib/tabelas-db";

/**
 * Monta o espelho do mês: marcações originais + ajustes aprovados (inclusões e
 * desconsiderações — a marcação original nunca é apagada) + justificativas aprovadas.
 */
export async function espelhoDoMes(e: Empregado, ano: number, mes: number, hoje: Date = hojeBrasil()) {
  const inicio = data(ano, mes, 1);
  const fim = ultimoDiaMes(ano, mes);
  // Margem de 1 dia para jornadas que atravessam a meia-noite
  const de = new Date(addDias(inicio, -1).getTime() + 3 * 3600_000);
  const ate = new Date(addDias(fim, 2).getTime() + 3 * 3600_000);
  const [marcacoes, ajustes, justificativas, tratamentos] = await Promise.all([
    prisma.marcacaoPonto.findMany({ where: { empregadoId: e.id, dataHora: { gte: de, lt: ate } }, orderBy: { dataHora: "asc" } }),
    prisma.ajustePonto.findMany({ where: { empregadoId: e.id, status: "APROVADO", data: { gte: addDias(inicio, -1), lte: addDias(fim, 1) } } }),
    prisma.justificativa.findMany({ where: { empregadoId: e.id, status: "APROVADO", data: { lte: fim }, OR: [{ dataFim: null, data: { gte: inicio } }, { dataFim: { gte: inicio } }] } }),
    prisma.tratamentoDia.findMany({ where: { empregadoId: e.id, data: { gte: inicio, lte: fim } } }),
  ]);

  const desconsideradas = new Set(ajustes.filter((a) => a.tipo === "DESCONSIDERAR" && a.marcacaoId).map((a) => a.marcacaoId!));
  const instantes = [
    ...marcacoes.filter((m) => !desconsideradas.has(m.id)).map((m) => m.dataHora),
    ...ajustes.filter((a) => a.tipo === "INCLUSAO" && a.dataHora).map((a) => a.dataHora!),
  ];
  const jornadas = agruparJornadas(instantes);
  const cfg = { ...configJornada(e), limites: parametrosJornada(await registrosParametros(), fim) };

  const diaJustificado = (d: Date) =>
    justificativas.find((j) => soData(d) >= j.data && soData(d) <= (j.dataFim ?? j.data));

  const dias: ResultadoDia[] = [];
  let ultimaSaida: Date | null = null;
  for (const d of diasDoMes(ano, mes)) {
    if (d < soData(e.admissao) || (e.desligamento && d > e.desligamento) || d > hoje) continue;
    const jornada = jornadas.find((j) => j.data.getTime() === d.getTime());
    const just = diaJustificado(d);
    let previstoMinutos: number | undefined;
    if (e.regime === "DOZE_X_TRINTA_SEIS") previstoMinutos = ehDiaDeTrabalho12x36(d, e.referencia12x36 ?? e.admissao) ? 720 : 0;
    const r = calcularDia({
      data: d,
      marcacoes: jornada?.marcacoes ?? [],
      config: cfg,
      previstoMinutos,
      abonado: Boolean(just && just.tipo !== "VIAGEM"),
      viagem: just?.tipo === "VIAGEM",
      // Decisão do patrão sobre as horas que faltaram (abonar, compensar ou descontar)
      tratamento: tratamentos.find((t) => t.data.getTime() === d.getTime())?.tratamento as "ABONAR" | "COMPENSAR" | "DESCONTAR" | undefined,
      ultimaSaidaAnterior: ultimaSaida,
    });
    if (just) r.inconsistencias = r.inconsistencias.filter((i) => !i.includes("ímpar"));
    if (d.getTime() === hoje.getTime()) {
      // Jornada de hoje ainda em andamento: não gera falta nem atraso
      r.falta = false;
      r.atraso = 0;
      r.inconsistencias = r.inconsistencias.filter((i) => !i.includes("ímpar"));
    }
    dias.push(r);
    if (jornada?.marcacoes.length) ultimaSaida = jornada.marcacoes[jornada.marcacoes.length - 1];
  }

  const resumo = consolidarMes(dias, cfg);
  const salario = num(e.salario);
  const horas = num(e.horasSemanais);
  const h = (min: number) => arred(min / 60, 2);
  const faltas = descontoFaltas(salario, resumo.faltas, resumo.semanasComFalta);
  const valores = {
    horasExtras50: valorHorasExtras(salario, horas, h(resumo.extrasPagas50), 50).valor,
    horasExtras100: valorHorasExtras(salario, horas, h(resumo.extras100), 100).valor,
    adicionalNoturno: valorAdicionalNoturno(salario, horas, h(resumo.noturno), 20).valor,
    faltas: faltas.faltas,
    dsrPerdido: faltas.dsr,
    atrasos: descontoAtrasos(salario, horas, resumo.atrasoDescontado).valor,
    intervaloSuprimido: arred((salario / (horas * 5)) * 1.5 * h(resumo.intervaloSuprimido)),
  };

  return {
    dias,
    resumo,
    valores,
    marcacoes: marcacoes.filter((m) => {
      const dl = partesLocais(m.dataHora).data;
      return dl >= addDias(inicio, -1) && dl <= fim;
    }),
    ajustes,
    justificativas,
    tratamentos,
    horas: {
      previsto: h(resumo.previsto),
      trabalhado: h(resumo.trabalhado),
      extras50: h(resumo.extrasPagas50),
      extras100: h(resumo.extras100),
      noturno: resumo.noturno / 60,
      banco: h(resumo.paraBanco),
      atraso: resumo.atrasoDescontado,
      intervaloSuprimido: h(resumo.intervaloSuprimido),
      viagem: h(resumo.viagem),
    },
  };
}

/**
 * Fecha o mês a partir do ponto: grava as informações do mês (faltas, atrasos, extras, noturno) para a folha
 * e marca "informações recebidas" na rotina do consultor. Opcionalmente registra o adiantamento pago.
 */
export async function fecharMesPeloPonto(e: Empregado, ano: number, mes: number, usuarioId: string, adiantamento?: number) {
  const esp = await espelhoDoMes(e, ano, mes, ultimoDiaMes(ano, mes) < hojeBrasil() ? ultimoDiaMes(ano, mes) : hojeBrasil());
  const dados = {
    faltasInjustificadas: esp.resumo.faltas,
    semanasComFalta: esp.resumo.semanasComFalta,
    faltasJustificadas: esp.resumo.faltasJustificadas,
    atrasoMinutos: esp.resumo.atrasoDescontado,
    horasExtras50: esp.horas.extras50,
    horasExtras100: esp.horas.extras100,
    horasNoturnas: arred(esp.horas.noturno, 2),
    horasViagem: esp.horas.viagem,
    horasIntervaloSuprimido: esp.horas.intervaloSuprimido,
    origem: "PONTO",
    enviadoPorId: usuarioId,
    observacoes: esp.horas.banco ? `Banco de horas: +${esp.horas.banco} h no mês` : null,
    ...(adiantamento !== undefined ? { adiantamento } : {}),
  };
  await prisma.lancamentoMensal.upsert({ where: { empregadoId_ano_mes: { empregadoId: e.id, ano, mes } }, create: { empregadoId: e.id, ano, mes, ...dados }, update: dados });
  await prisma.competencia.upsert({ where: { empregadoId_ano_mes: { empregadoId: e.id, ano, mes } }, create: { empregadoId: e.id, ano, mes, infoRecebida: true }, update: { infoRecebida: true } });
  return esp;
}

/** Resumo do mês em uma frase, para o patrão conferir antes de fechar. */
export function resumoDoMes(esp: Awaited<ReturnType<typeof espelhoDoMes>>): string {
  const partes = [
    esp.resumo.faltas ? `${esp.resumo.faltas} falta(s)` : "nenhuma falta",
    esp.resumo.faltasJustificadas ? `${esp.resumo.faltasJustificadas} justificada(s)` : "",
    esp.resumo.atrasoDescontado ? `${esp.resumo.atrasoDescontado} min de atraso/saída antecipada` : "",
    esp.horas.extras50 + esp.horas.extras100 ? `${String(arred(esp.horas.extras50 + esp.horas.extras100, 2)).replace(".", ",")} h extras` : "sem horas extras",
    esp.resumo.noturno ? "com horas noturnas" : "",
  ].filter(Boolean);
  return `${partes.join(", ")}.`;
}
