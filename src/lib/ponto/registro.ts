import "server-only";
import type { TipoMarcacao } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashMarcacao } from "./hash";

export const ROTULO_MARCACAO: Record<TipoMarcacao, string> = {
  ENTRADA: "Entrada",
  SAIDA_INTERVALO: "Saída para intervalo",
  RETORNO_INTERVALO: "Retorno do intervalo",
  SAIDA: "Saída",
};

/** Limite para aceitar marcações offline atrasadas (o aparelho pode ficar dias sem internet). */
const MAX_ATRASO_SINCRONIZACAO_MS = 7 * 24 * 3600 * 1000;
/** Tolerância para relógio do aparelho adiantado. */
const MAX_ADIANTAMENTO_MS = 5 * 60 * 1000;

export interface NovaMarcacao {
  empregadoId: string;
  cpf: string;
  tipo: TipoMarcacao;
  dataHora: Date;
  idLocal: string;
  origem: "ONLINE" | "OFFLINE";
  latitude?: number | null;
  longitude?: number | null;
  precisaoMetros?: number | null;
  selfieArquivoId?: string | null;
  dispositivo?: string | null;
  ip?: string | null;
}

/**
 * Grava a marcação de forma inalterável, encadeando o hash SHA-256 com a
 * marcação anterior do mesmo empregado (qualquer alteração quebra a cadeia).
 * É idempotente pelo idLocal (sincronização offline repetida não duplica).
 */
export async function registrarMarcacao(m: NovaMarcacao) {
  const existente = await prisma.marcacaoPonto.findUnique({ where: { idLocal: m.idLocal } });
  if (existente) return { marcacao: existente, duplicada: true };

  const agora = Date.now();
  if (m.dataHora.getTime() > agora + MAX_ADIANTAMENTO_MS) throw new Error("Horário da marcação está no futuro. Confira o relógio do celular.");
  if (agora - m.dataHora.getTime() > MAX_ATRASO_SINCRONIZACAO_MS) throw new Error("Marcação offline com mais de 7 dias. Peça um ajuste ao empregador.");

  return prisma.$transaction(async (tx) => {
    // Trava por empregado para manter a cadeia de hash consistente
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${m.empregadoId}))`;
    const anterior = await tx.marcacaoPonto.findFirst({ where: { empregadoId: m.empregadoId }, orderBy: { nsr: "desc" }, select: { hash: true } });
    const marcacao = await tx.marcacaoPonto.create({
      data: {
        empregadoId: m.empregadoId,
        tipo: m.tipo,
        dataHora: m.dataHora,
        latitude: m.latitude ?? null,
        longitude: m.longitude ?? null,
        precisaoMetros: m.precisaoMetros ?? null,
        selfieArquivoId: m.selfieArquivoId ?? null,
        origem: m.origem,
        dispositivo: m.dispositivo?.slice(0, 250) ?? null,
        ip: m.ip,
        idLocal: m.idLocal,
        hashAnterior: anterior?.hash ?? null,
        hash: hashMarcacao({ ...m, hashAnterior: anterior?.hash }),
      },
    });
    return { marcacao, duplicada: false };
  });
}

/** Confere a cadeia de hash das marcações de um empregado. */
export async function verificarCadeia(empregadoId: string, cpf: string) {
  const lista = await prisma.marcacaoPonto.findMany({ where: { empregadoId }, orderBy: { nsr: "asc" } });
  let anterior = "";
  for (const m of lista) {
    if (hashMarcacao({ ...m, cpf, hashAnterior: anterior }) !== m.hash || (m.hashAnterior ?? "") !== anterior) return { integra: false, nsr: m.nsr };
    anterior = m.hash;
  }
  return { integra: true, total: lista.length };
}

/** Próximo tipo de marcação sugerido a partir das marcações do dia. */
export function proximoTipo(tiposHoje: TipoMarcacao[]): TipoMarcacao {
  const ultimo = tiposHoje[tiposHoje.length - 1];
  if (!ultimo || ultimo === "SAIDA") return "ENTRADA";
  if (ultimo === "ENTRADA") return "SAIDA_INTERVALO";
  if (ultimo === "SAIDA_INTERVALO") return "RETORNO_INTERVALO";
  return "SAIDA";
}
