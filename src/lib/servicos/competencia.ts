import { competenciaAnterior, hojeBrasil } from "@/lib/calculos";

/** Competência em foco na rotina: até o dia 15 trabalha-se o mês anterior; depois, o mês atual. */
export function competenciaPadrao(hoje: Date = hojeBrasil()) {
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth() + 1;
  return hoje.getUTCDate() <= 15 ? competenciaAnterior(ano, mes) : { ano, mes };
}

export function lerCompetencia(params: { ano?: string; mes?: string }, hoje?: Date) {
  const padrao = competenciaPadrao(hoje);
  const ano = Number(params.ano) || padrao.ano;
  const mes = Number(params.mes) || padrao.mes;
  if (mes < 1 || mes > 12 || ano < 2015 || ano > 2100) return padrao;
  return { ano, mes };
}
