/** Gera CSV no padrão do Excel brasileiro (separador ";" e BOM UTF-8). */
export function gerarCsv(cabecalho: string[], linhas: (string | number | null | undefined | Date)[][]): string {
  const celula = (v: string | number | null | undefined | Date) => {
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10).split("-").reverse().join("/");
    if (typeof v === "number") return String(v).replace(".", ",");
    const t = String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return "﻿" + [cabecalho, ...linhas].map((l) => l.map(celula).join(";")).join("\r\n");
}
