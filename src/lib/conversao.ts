import type { Empregado, Prisma, TabelaAnual as TabelaDb } from "@prisma/client";
import type { ConfigJornada, DiaSemana, FaixaInss, JornadaSemanal, TabelaAnual } from "./calculos";

/** Converte Decimal do Prisma (ou null) para number. */
export function num(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

export function tabelaDoBanco(t: TabelaDb): TabelaAnual {
  return {
    ano: t.ano,
    salarioMinimo: num(t.salarioMinimo),
    faixasInss: (t.faixasInss as unknown as FaixaInss[]).map((f) => ({ ate: Number(f.ate), aliquota: Number(f.aliquota) })),
    salarioFamiliaLimite: num(t.salarioFamiliaLimite),
    salarioFamiliaCota: num(t.salarioFamiliaCota),
    aliquotas: {
      inssPatronal: num(t.inssPatronal),
      gilrat: num(t.gilrat),
      fgts: num(t.fgts),
      fgtsCompensatorio: num(t.fgtsCompensatorio),
    },
    arredondamentoDae: t.arredondamentoDae === "arredondar" ? "arredondar" : "truncar",
  };
}

export function jornadaDoEmpregado(e: Pick<Empregado, "jornada">): JornadaSemanal {
  const j = (e.jornada ?? {}) as Record<string, unknown>;
  const r: JornadaSemanal = {};
  for (const [k, v] of Object.entries(j)) if (Number(v) > 0) r[k as DiaSemana] = Number(v);
  return r;
}

export function horariosDoEmpregado(e: Pick<Empregado, "horarios">): ConfigJornada["horarios"] {
  if (!e.horarios) return undefined;
  return e.horarios as ConfigJornada["horarios"];
}

export function configJornada(e: Empregado): ConfigJornada {
  return {
    regime: e.regime,
    horasSemanais: num(e.horasSemanais),
    jornada: jornadaDoEmpregado(e),
    horarios: horariosDoEmpregado(e),
    toleranciaMarcacao: e.toleranciaMinutos,
    toleranciaDiaria: e.toleranciaMinutos * 2,
    acordoCompensacao: e.acordoCompensacao,
    acordoIntervaloReduzido: e.acordoIntervaloReduzido,
    residenteNoLocal: e.residenteNoLocal,
  };
}

/** Serializa para passar de Server para Client Components (Decimal e Date → tipos simples). */
export function serializar<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? Number(val) : val)));
}
