import "server-only";
import type { Empregado } from "@prisma/client";
import {
  addDias, agruparJornadas, calcularDia, hojeBrasil, consolidarMes, data, diasDoMes, ehDiaDeTrabalho12x36, partesLocais, soData, ultimoDiaMes,
  valorAdicionalNoturno, valorHorasExtras, descontoFaltas, descontoAtrasos, arred, type ResultadoDia,
} from "@/lib/calculos";
import { configJornada, num } from "@/lib/conversao";
import { prisma } from "@/lib/db";

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
  const [marcacoes, ajustes, justificativas] = await Promise.all([
    prisma.marcacaoPonto.findMany({ where: { empregadoId: e.id, dataHora: { gte: de, lt: ate } }, orderBy: { dataHora: "asc" } }),
    prisma.ajustePonto.findMany({ where: { empregadoId: e.id, status: "APROVADO", data: { gte: addDias(inicio, -1), lte: addDias(fim, 1) } } }),
    prisma.justificativa.findMany({ where: { empregadoId: e.id, status: "APROVADO", data: { lte: fim }, OR: [{ dataFim: null, data: { gte: inicio } }, { dataFim: { gte: inicio } }] } }),
  ]);

  const desconsideradas = new Set(ajustes.filter((a) => a.tipo === "DESCONSIDERAR" && a.marcacaoId).map((a) => a.marcacaoId!));
  const instantes = [
    ...marcacoes.filter((m) => !desconsideradas.has(m.id)).map((m) => m.dataHora),
    ...ajustes.filter((a) => a.tipo === "INCLUSAO" && a.dataHora).map((a) => a.dataHora!),
  ];
  const jornadas = agruparJornadas(instantes);
  const cfg = configJornada(e);

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
