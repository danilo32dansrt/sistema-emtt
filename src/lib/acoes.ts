/** Estado devolvido pelas Server Actions dos formulários. */
export type EstadoAcao = { ok?: boolean; erro?: string; mensagem?: string; dados?: unknown } | null;

import { ZodError } from "zod";

export function erroParaEstado(e: unknown): EstadoAcao {
  if (e instanceof ZodError) {
    const primeiro = e.issues[0];
    return { erro: primeiro?.message ?? "Dados inválidos." };
  }
  if (e instanceof Error) {
    // Erros de redirect do Next precisam continuar subindo
    if ("digest" in e && typeof (e as { digest?: unknown }).digest === "string" && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
    if (e.message.includes("Unique constraint")) return { erro: "Já existe um registro com esses dados." };
    return { erro: e.message };
  }
  return { erro: "Erro inesperado. Tente novamente." };
}
