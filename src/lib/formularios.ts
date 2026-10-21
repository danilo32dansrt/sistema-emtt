import { z } from "zod";
import { lerData, lerMoeda, somenteDigitos } from "./calculos";

/** Helpers do Zod para os campos dos formulários em português. */

export const texto = (rotulo: string, min = 1) =>
  z.string({ required_error: `Informe ${rotulo}.` }).trim().min(min, `Informe ${rotulo}.`);

export const textoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

export const dataCampo = (rotulo: string) =>
  z.string({ required_error: `Informe ${rotulo}.` }).trim().min(1, `Informe ${rotulo}.`).transform((v, ctx) => {
    try {
      return lerData(v);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${rotulo[0].toUpperCase()}${rotulo.slice(1)} inválida.` });
      return z.NEVER;
    }
  });

export const dataOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    try {
      return lerData(v);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Data inválida." });
      return z.NEVER;
    }
  });

export const moeda = (rotulo: string) =>
  z.string().trim().transform((v, ctx) => {
    try {
      const n = lerMoeda(v);
      if (n < 0) throw new Error();
      return n;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Valor inválido em ${rotulo}.` });
      return z.NEVER;
    }
  });

export const numero = (rotulo: string, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? "0" : v.replace(",", ".")))
    .pipe(z.coerce.number({ invalid_type_error: `Número inválido em ${rotulo}.` }).min(min, `${rotulo}: mínimo ${min}.`).max(max, `${rotulo}: máximo ${max}.`));

export const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true" || v === "1");

export const cpfCampo = z.string().trim().transform((v) => somenteDigitos(v));

export function dadosDoForm(fd: FormData): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") r[k] = v;
  return r;
}
