import "server-only";
import type { Empregado } from "@prisma/client";
import { hojeBrasil, parametrosJornada, periodosFerias, validarEmpregado, diasDireitoFerias, type RegraFeriasParcial } from "@/lib/calculos";
import { jornadaDoEmpregado, num } from "@/lib/conversao";
import { registrosParametros, tabelaDoAno } from "@/lib/tabelas-db";

/** Alertas de cadastro do empregado com a tabela do ano corrente. */
export async function validacoesDoEmpregado(e: Empregado, hoje = hojeBrasil()) {
  const { tabela } = await tabelaDoAno(hoje.getUTCFullYear());
  return validarEmpregado({
    salario: num(e.salario),
    regime: e.regime,
    jornada: jornadaDoEmpregado(e),
    admissao: e.admissao,
    nascimento: e.nascimento,
    cpf: e.cpf,
    salarioMinimo: tabela.salarioMinimo,
    diasExperiencia: e.diasExperiencia,
    acordoEscrito12x36: e.acordo12x36,
    acordoCompensacao: e.acordoCompensacao,
    limites: parametrosJornada(await registrosParametros(), hoje),
    hoje,
  });
}

export function feriasDoEmpregado(e: Empregado & { ferias: { inicioAquisitivo: Date; dias: number; diasAbono: number }[] }, regraParcial: RegraFeriasParcial, hoje = hojeBrasil()) {
  const direito = diasDireitoFerias(e.regime, num(e.horasSemanais), 0, regraParcial);
  const ref = e.desligamento ?? hoje;
  return {
    direito,
    periodos: periodosFerias(e.admissao, ref, e.ferias.map((f) => ({ inicioAquisitivo: f.inicioAquisitivo, dias: f.dias + f.diasAbono })), direito.dias),
  };
}
