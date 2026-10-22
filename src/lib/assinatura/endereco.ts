import "server-only";

/**
 * Endereço base da verificação impresso no carimbo: o domínio próprio de verificação (VERIFICACAO_URL, ex.:
 * https://verifica.seudominio.com.br) ou, sem ele, <APP_URL>/verificar.
 */
export function baseVerificacao(): string {
  const propria = (process.env.VERIFICACAO_URL ?? "").trim().replace(/\/$/, "");
  if (propria) return propria;
  return `${(process.env.APP_URL ?? "").trim().replace(/\/$/, "")}/verificar`;
}
