import { z } from "zod";
import { formatarCompetencia, lerData } from "@/lib/calculos";
import { moeda, numero, textoOpcional } from "@/lib/formularios";

export const esquemaLancamento = z.object({
  empregadoId: z.string(),
  ano: z.coerce.number().int(),
  mes: z.coerce.number().int().min(1).max(12),
  datasFaltas: z.string().optional(),
  faltasJustificadas: numero("faltas justificadas", 0, 31),
  atrasoMinutos: numero("atrasos", 0, 10000),
  horasExtras50: numero("horas extras 50%", 0, 200),
  horasExtras100: numero("horas extras 100%", 0, 200),
  horasNoturnas: numero("horas noturnas", 0, 300),
  adiantamento: z.string().optional().transform((v) => v || "0").pipe(moeda("adiantamento")),
  observacoes: textoOpcional,
});

/** Interpreta "02/03, 05/03/2026" como datas da competência. */
export function lerDatasFaltas(texto: string | undefined, ano: number, mes: number): Date[] {
  if (!texto?.trim()) return [];
  return texto.split(/[,;\s]+/).filter(Boolean).map((t) => {
    const partes = t.split("/");
    const d = lerData(partes.length === 2 ? `${t}/${ano}` : t);
    if (d.getUTCMonth() + 1 !== mes || d.getUTCFullYear() !== ano) throw new Error(`A falta ${t} não é da competência ${formatarCompetencia(ano, mes)}.`);
    return d;
  });
}

