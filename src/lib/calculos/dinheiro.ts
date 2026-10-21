/**
 * Funções de dinheiro. Todos os valores são em reais (number) e o
 * arredondamento é sempre explícito, para que a memória de cálculo
 * mostre exatamente o que o sistema fez.
 */

const EPS = 1e-6;

/** Arredonda "meio para cima" com a quantidade de casas desejada (padrão 2). */
export function arred(valor: number, casas = 2): number {
  const fator = 10 ** casas;
  const r = (Math.sign(valor) * Math.round(Math.abs(valor) * fator + EPS)) / fator;
  return r === 0 ? 0 : r;
}

/** Trunca (descarta as casas além do centavo). É o que o eSocial faz nas parcelas do DAE. */
export function truncar(valor: number, casas = 2): number {
  const fator = 10 ** casas;
  const r = (Math.sign(valor) * Math.floor(Math.abs(valor) * fator + EPS)) / fator;
  return r === 0 ? 0 : r;
}

export type ModoArredondamento = "arredondar" | "truncar";

export function aplicarModo(valor: number, modo: ModoArredondamento): number {
  return modo === "truncar" ? truncar(valor) : arred(valor);
}

/** Soma valores monetários evitando lixo de ponto flutuante. */
export function somar(...valores: number[]): number {
  return arred(valores.reduce((a, b) => a + b, 0));
}

/** Aplica um percentual (ex.: 7.5 = 7,5%). */
export function percentual(base: number, aliquota: number): number {
  return (base * aliquota) / 100;
}

const formatador = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatadorNumero = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** R$ 1.234,56 (com espaço normal, para facilitar mensagens de WhatsApp e PDFs). */
export function formatarMoeda(valor: number): string {
  return formatador.format(arred(valor)).replace(/ /g, " ");
}

/** 1.234,56 */
export function formatarNumero(valor: number): string {
  return formatadorNumero.format(arred(valor));
}

export function formatarPercentual(aliquota: number): string {
  return `${aliquota.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;
}

/** Converte "1.234,56", "1234,56", "1234.56" ou "R$ 1.234,56" para número. */
export function lerMoeda(texto: string | number | null | undefined): number {
  if (texto === null || texto === undefined) return 0;
  if (typeof texto === "number") return texto;
  let t = texto.replace(/[R$\s ]/g, "").trim();
  if (!t) return 0;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error(`Valor inválido: ${texto}`);
  return n;
}
