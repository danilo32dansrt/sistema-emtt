import { PDFDocument, PDFFont, PDFHexString, PDFName, PDFPage, PDFString, rgb, StandardFonts } from "pdf-lib";
import {
  CARIMBO, emPontos, linhasCarimbo, posicoesDosCarimbos,
  type DadosCarimbo, type LocalAssinatura, type PapelSignatario, type PosicaoCarimbo, type TamanhoPagina,
} from "@/lib/assinatura/carimbo";
import { CHAVE_LOCAIS, propriedadesPdf, textoSeguro } from "./base";

const AZUL = rgb(0.08, 0.13, 0.24);
const VERDE = rgb(0.09, 0.45, 0.25);
const CINZA = rgb(0.45, 0.45, 0.45);

/** Linhas de assinatura gravadas no PDF ao ser gerado (documentos antigos não têm: lista vazia). */
export function lerLocais(doc: PDFDocument): LocalAssinatura[] {
  try {
    const v = propriedadesPdf(doc)?.lookup(PDFName.of(CHAVE_LOCAIS));
    const txt = v instanceof PDFHexString || v instanceof PDFString ? v.decodeText() : "";
    const lista = txt ? (JSON.parse(txt) as LocalAssinatura[]) : [];
    return Array.isArray(lista) ? lista.filter((l) => Number.isFinite(l.pagina) && Number.isFinite(l.x) && Number.isFinite(l.y)) : [];
  } catch {
    return [];
  }
}

/** Tamanho das páginas e linhas de assinatura de um PDF. */
export async function infoPdf(bytes: Uint8Array): Promise<{ paginas: TamanhoPagina[]; locais: LocalAssinatura[] }> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  return { paginas: doc.getPages().map((p) => ({ largura: p.getWidth(), altura: p.getHeight() })), locais: lerLocais(doc) };
}

function cortar(t: string, fonte: PDFFont, tamanho: number, largura: number) {
  let s = textoSeguro(t);
  while (s.length > 1 && fonte.widthOfTextAtSize(s, tamanho) > largura) s = s.slice(0, -1);
  return s;
}

/** Desenha o carimbo (selo com visto + 5 linhas de texto) com o canto inferior esquerdo em (x, y). */
export function desenharCarimbo(pagina: PDFPage, fontes: { normal: PDFFont; negrito: PDFFont }, x: number, y: number, dados: DadosCarimbo) {
  const { largura: L, altura: A } = CARIMBO;
  pagina.drawRectangle({ x, y, width: L, height: A, color: rgb(1, 1, 1), opacity: 0.92 });
  const cx = x + 15;
  const cy = y + A / 2;
  pagina.drawCircle({ x: cx, y: cy, size: 12, borderColor: VERDE, borderWidth: 1.4 });
  pagina.drawLine({ start: { x: cx - 5.5, y: cy + 0.5 }, end: { x: cx - 1.5, y: cy - 4 }, thickness: 1.8, color: VERDE });
  pagina.drawLine({ start: { x: cx - 1.5, y: cy - 4 }, end: { x: cx + 6, y: cy + 5 }, thickness: 1.8, color: VERDE });
  const tx = x + 32;
  const lt = L - 34;
  const linhas = linhasCarimbo(dados);
  const estilos: [PDFFont, number][] = [[fontes.negrito, 6.2], [fontes.negrito, 6.8], [fontes.normal, 5.8], [fontes.normal, 5.8], [fontes.normal, 5.8]];
  let base = y + A - 8.5;
  linhas.forEach((l, i) => {
    const [f, t] = estilos[i];
    pagina.drawText(cortar(l, f, t, lt), { x: tx, y: base, size: t, font: f, color: i < 2 ? AZUL : CINZA });
    base -= i === 0 ? 7.6 : 7.1;
  });
}

export interface AssinaturaPdf {
  usuarioId: string;
  nome: string;
  papel: PapelSignatario;
  data: Date;
  ip?: string | null;
  hash: string;
}

const ROTULO_PAPEL: Record<PapelSignatario, string> = { CLIENTE: "Empregador(a)", EMPREGADO: "Empregado(a)", CONSULTOR: "Consultoria" };

/**
 * PDF assinado: desenha o carimbo de cada assinatura no lugar escolhido (ou acima da linha do papel) e acrescenta
 * a página de registro das assinaturas. O arquivo original e o hash assinado não mudam: tudo é desenhado na hora.
 */
export async function montarPdfAssinado(
  original: Uint8Array,
  assinaturas: AssinaturaPdf[],
  salvas: Partial<Record<string, PosicaoCarimbo>>,
  opcoes: { codigo: string; endereco?: string },
) {
  const doc = await PDFDocument.load(original);
  const fontes = { normal: await doc.embedFont(StandardFonts.Helvetica), negrito: await doc.embedFont(StandardFonts.HelveticaBold) };
  const paginas = doc.getPages();
  const tamanhos = paginas.map((p) => ({ largura: p.getWidth(), altura: p.getHeight() }));
  const posicoes = posicoesDosCarimbos(assinaturas, salvas, lerLocais(doc), tamanhos);
  const semLugar: AssinaturaPdf[] = [];
  for (const a of assinaturas) {
    const pos = posicoes[a.usuarioId];
    if (!pos) {
      semLugar.push(a);
      continue;
    }
    const pt = emPontos(pos, tamanhos[pos.pagina]);
    desenharCarimbo(paginas[pos.pagina], fontes, pt.x, pt.y, { nome: a.nome, data: a.data, codigo: opcoes.codigo, endereco: opcoes.endereco });
  }

  // Página de registro das assinaturas.
  const [W, H] = [595.28, 841.89];
  const p = doc.addPage([W, H]);
  const M = 50;
  let y = H - M;
  const linha = (t: string, f = fontes.normal, tam = 10) => {
    p.drawText(cortar(t, f, tam, W - 2 * M), { x: M, y: y - tam, size: tam, font: f });
    y -= tam + 6;
  };
  linha("Registro de assinaturas eletrônicas", fontes.negrito, 14);
  linha("Assinatura eletrônica simples (Lei 14.063/2020, art. 4º, I), com identificação do signatário, data, hora e endereço IP.", fontes.normal, 8);
  y -= 6;
  for (const a of assinaturas) {
    linha(`${a.nome} (${ROTULO_PAPEL[a.papel]})`, fontes.negrito);
    linha(`Assinado em ${a.data.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}${a.ip ? ` — IP ${a.ip}` : ""}`);
    linha(`Hash SHA-256 do documento assinado: ${a.hash}`, fontes.normal, 7);
    y -= 4;
  }
  y -= 10;
  linha(`Código de verificação: ${opcoes.codigo}`, fontes.negrito, 9);
  if (semLugar.length) {
    y -= 8;
    semLugar.forEach((a, i) => {
      const col = i % 2;
      if (col === 0 && i > 0) y -= CARIMBO.altura + 8;
      desenharCarimbo(p, fontes, M + col * (CARIMBO.largura + 20), y - CARIMBO.altura, { nome: a.nome, data: a.data, codigo: opcoes.codigo, endereco: opcoes.endereco });
    });
  }
  p.drawText(textoSeguro("Os carimbos de assinatura são desenhados sobre o documento original; o hash acima é o do arquivo assinado."), { x: M, y: 30, size: 7, font: fontes.normal, color: CINZA });
  return doc.save();
}
