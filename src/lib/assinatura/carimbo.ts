/**
 * Carimbo de assinatura eletrônica (no estilo do gov.br): quadro pequeno, de tamanho fixo, que cada signatário
 * posiciona na página arrastando. Regras puras (sem banco e sem pdf-lib), usadas no servidor e na tela.
 *
 * Posição guardada como fração da página (0 a 1), a partir do canto superior esquerdo, para valer em qualquer
 * tamanho de tela. A posição é só visual: não muda o arquivo original nem o hash assinado.
 */

/** Tamanho fixo do carimbo, em pontos de PDF (1 pt = 1/72 pol.): cerca de 7,6 cm × 1,5 cm (QR Code + 5 linhas). */
export const CARIMBO = { largura: 216, altura: 42 } as const;

/** Linhas do carimbo, no modelo aprovado: tamanho (pt), negrito e espaço extra depois (pt). Fonte Times. */
export const ESTILO_LINHAS: { tamanho: number; negrito: boolean; depois: number }[] = [
  { tamanho: 8.2, negrito: false, depois: 2.5 },
  { tamanho: 9.4, negrito: true, depois: 0 },
  { tamanho: 6.8, negrito: true, depois: 0 },
  { tamanho: 4.5, negrito: false, depois: 0 },
  { tamanho: 5.6, negrito: false, depois: 0 },
];

export type PapelSignatario = "CLIENTE" | "EMPREGADO" | "CONSULTOR";

export interface PosicaoCarimbo {
  /** Página, começando em 0. */
  pagina: number;
  /** Canto superior esquerdo, em fração da largura da página. */
  x: number;
  /** Canto superior esquerdo, em fração da altura da página (de cima para baixo). */
  y: number;
}

/** Linha de assinatura desenhada no PDF (coordenadas do PDF: origem embaixo à esquerda). */
export interface LocalAssinatura {
  pagina: number;
  x: number;
  y: number;
  largura: number;
  papel: string;
}

export interface TamanhoPagina {
  largura: number;
  altura: number;
}

const limitar = (v: number, min: number, max: number) => Math.min(Math.max(Number.isFinite(v) ? v : min, min), max);

/** Mantém o carimbo inteiro dentro de uma página existente. */
export function limitarPosicao(p: PosicaoCarimbo, paginas: TamanhoPagina[]): PosicaoCarimbo {
  const pagina = Math.round(limitar(p.pagina, 0, Math.max(paginas.length - 1, 0)));
  const t = paginas[pagina] ?? { largura: 595.28, altura: 841.89 };
  return {
    pagina,
    x: limitar(p.x, 0, 1 - CARIMBO.largura / t.largura),
    y: limitar(p.y, 0, 1 - CARIMBO.altura / t.altura),
  };
}

/** Converte a posição (fração, de cima para baixo) para o canto inferior esquerdo em pontos do PDF. */
export function emPontos(p: PosicaoCarimbo, t: TamanhoPagina) {
  return { x: p.x * t.largura, y: t.altura - p.y * t.altura - CARIMBO.altura };
}

/** Quem assina em cada linha, pelo rótulo impresso embaixo dela. Testemunhas assinam no papel. */
export function papelDaLinha(rotulo: string): PapelSignatario | null {
  const r = rotulo.toLowerCase();
  if (r.includes("testemunha")) return null;
  if (r.includes("empregador") || r.includes("contratante")) return "CLIENTE";
  if (r.includes("empregado")) return "EMPREGADO";
  if (r.includes("consultoria") || r.includes("contratada")) return "CONSULTOR";
  return null;
}

/**
 * Lugar inicial do carimbo: logo acima da linha de assinatura do papel do signatário (a n-ésima linha daquele
 * papel, quando há mais de um signatário com o mesmo papel). Sem linha, retorna null.
 */
export function posicaoPadrao(papel: PapelSignatario, ordem: number, locais: LocalAssinatura[], paginas: TamanhoPagina[]): PosicaoCarimbo | null {
  const doPapel = locais.filter((l) => papelDaLinha(l.papel) === papel);
  const l = doPapel[ordem] ?? (doPapel.length ? doPapel[doPapel.length - 1] : undefined);
  if (!l) return null;
  const t = paginas[l.pagina] ?? { largura: 595.28, altura: 841.89 };
  const extra = doPapel[ordem] ? 0 : (ordem - doPapel.length + 1) * (CARIMBO.altura + 4);
  const centro = l.x + Math.max(l.largura - CARIMBO.largura, 0) / 2;
  const topoPt = l.y + 2 + CARIMBO.altura + extra;
  return limitarPosicao({ pagina: l.pagina, x: centro / t.largura, y: (t.altura - topoPt) / t.altura }, paginas);
}

/** Diferença para o UTC no horário de Brasília naquela data, calculada pelo relógio oficial (ex.: "-0300"). */
export function fusoHorario(d: Date, zona = "America/Sao_Paulo"): string {
  const nome = new Intl.DateTimeFormat("en-US", { timeZone: zona, timeZoneName: "longOffset" }).formatToParts(d).find((x) => x.type === "timeZoneName")?.value ?? "";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(nome);
  return m ? `${m[1]}${m[2]}${m[3] ?? "00"}` : "+0000";
}

/** Data e hora de Brasília no formato do carimbo: 22/10/2026 14:05:09-0300. */
export function dataHoraCarimbo(d: Date): string {
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} ${v("hour")}:${v("minute")}:${v("second")}${fusoHorario(d)}`;
}

export interface DadosCarimbo {
  nome: string;
  /** Data da assinatura; sem data, o carimbo é só a prévia do lugar. */
  data?: Date | null;
  codigo: string;
  /** Endereço do sistema (APP_URL), para a linha "Verifique em" e o QR Code. */
  endereco?: string;
}

/** Endereço de verificação impresso no carimbo e gravado no QR Code: <sistema>/verificar/<código>. */
export function enderecoVerificacao(d: Pick<DadosCarimbo, "codigo" | "endereco">): string {
  return `${(d.endereco ?? "").replace(/\/$/, "")}/verificar/${d.codigo}`;
}

/** Texto do carimbo, linha a linha (estilo de cada linha em ESTILO_LINHAS). */
export function linhasCarimbo(d: DadosCarimbo): string[] {
  return [
    d.data ? "Documento assinado digitalmente" : "Assinatura digital (prévia do lugar)",
    d.nome.toUpperCase(),
    d.data ? `Data: ${dataHoraCarimbo(d.data)}` : "Data: após a assinatura",
    "art. 4º, I, da Lei nº 14.063/2020 e art. 10, § 2º, da MP nº 2.200-2/2001, com login e senha do signatário.",
    `Verifique em ${enderecoVerificacao(d)}`,
  ];
}

export interface Signatario {
  usuarioId: string;
  papel: PapelSignatario;
}

/**
 * Posição de cada carimbo: a escolhida pelo signatário (arrastando) ou, sem escolha, logo acima da linha de
 * assinatura do papel dele. Null quando não há linha: o carimbo vai para a página de registro das assinaturas.
 */
export function posicoesDosCarimbos(
  signatarios: Signatario[],
  salvas: Partial<Record<string, PosicaoCarimbo>>,
  locais: LocalAssinatura[],
  paginas: TamanhoPagina[],
): Record<string, PosicaoCarimbo | null> {
  const ordem: Partial<Record<PapelSignatario, number>> = {};
  const r: Record<string, PosicaoCarimbo | null> = {};
  for (const s of signatarios) {
    const n = ordem[s.papel] ?? 0;
    ordem[s.papel] = n + 1;
    const salva = salvas[s.usuarioId];
    r[s.usuarioId] = salva ? limitarPosicao(salva, paginas) : posicaoPadrao(s.papel, n, locais, paginas);
  }
  return r;
}
