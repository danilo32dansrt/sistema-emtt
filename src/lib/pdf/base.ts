import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";

/** Troca caracteres que as fontes padrão do PDF (WinAnsi) não suportam. */
export function textoSeguro(t: string): string {
  return t
    .replace(/[→⇒]/g, "->")
    .replace(/[✓✔]/g, "OK")
    .replace(/[−–]/g, "-")
    .replace(/[≤]/g, "<=")
    .replace(/[≥]/g, ">=")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7E -ÿ–—•€]/g, "");
}

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 50;

/** Pequeno "editor" de PDF: títulos, parágrafos com quebra automática, tabelas e assinaturas. */
export class DocPdf {
  private doc!: PDFDocument;
  private pagina!: PDFPage;
  private fonte!: PDFFont;
  private negrito!: PDFFont;
  private y = 0;
  private numeroPaginas = 0;

  constructor(private readonly cabecalho: { titulo: string; subtitulo?: string; rodape?: string }) {}

  static async criar(cabecalho: { titulo: string; subtitulo?: string; rodape?: string }) {
    const d = new DocPdf(cabecalho);
    d.doc = await PDFDocument.create();
    d.doc.setTitle(textoSeguro(cabecalho.titulo));
    d.doc.setCreator("Sistema eSocial Doméstico");
    d.doc.setLanguage("pt-BR");
    d.fonte = await d.doc.embedFont(StandardFonts.Helvetica);
    d.negrito = await d.doc.embedFont(StandardFonts.HelveticaBold);
    d.novaPagina();
    return d;
  }

  private get largura() {
    return A4[0] - MARGEM * 2;
  }

  novaPagina() {
    this.pagina = this.doc.addPage(A4);
    this.numeroPaginas++;
    this.y = A4[1] - MARGEM;
    if (this.cabecalho.rodape) {
      let r = textoSeguro(this.cabecalho.rodape);
      while (r.length > 10 && this.fonte.widthOfTextAtSize(r, 6.5) > this.largura - 50) r = r.slice(0, -1);
      this.pagina.drawText(r, { x: MARGEM, y: 25, size: 6.5, font: this.fonte, color: rgb(0.45, 0.45, 0.45) });
    }
    this.pagina.drawText(`Página ${this.numeroPaginas}`, { x: A4[0] - MARGEM - 40, y: 25, size: 7, font: this.fonte, color: rgb(0.45, 0.45, 0.45) });
  }

  private garantir(altura: number) {
    if (this.y - altura < MARGEM + 10) this.novaPagina();
  }

  private quebrar(texto: string, tamanho: number, fonte: PDFFont, largura = this.largura): string[] {
    const linhas: string[] = [];
    for (const paragrafo of texto.split("\n").map(textoSeguro)) {
      let atual = "";
      for (const palavra of paragrafo.split(/\s+/)) {
        const teste = atual ? `${atual} ${palavra}` : palavra;
        if (fonte.widthOfTextAtSize(teste, tamanho) > largura && atual) {
          linhas.push(atual);
          atual = palavra;
        } else atual = teste;
      }
      linhas.push(atual);
    }
    return linhas;
  }

  titulo(texto: string, tamanho = 15) {
    this.garantir(tamanho + 10);
    for (const l of this.quebrar(texto, tamanho, this.negrito)) {
      const w = this.negrito.widthOfTextAtSize(l, tamanho);
      this.pagina.drawText(l, { x: (A4[0] - w) / 2, y: this.y - tamanho, size: tamanho, font: this.negrito });
      this.y -= tamanho + 4;
    }
    this.y -= 6;
    return this;
  }

  subtitulo(texto: string) {
    this.garantir(20);
    this.y -= 4;
    this.pagina.drawText(textoSeguro(texto), { x: MARGEM, y: this.y - 11, size: 11, font: this.negrito });
    this.y -= 18;
    return this;
  }

  paragrafo(texto: string, opcoes: { tamanho?: number; negrito?: boolean; recuo?: number; espaco?: number } = {}) {
    const tamanho = opcoes.tamanho ?? 10;
    const fonte = opcoes.negrito ? this.negrito : this.fonte;
    const recuo = opcoes.recuo ?? 0;
    for (const l of this.quebrar(texto, tamanho, fonte, this.largura - recuo)) {
      this.garantir(tamanho + 4);
      this.pagina.drawText(l, { x: MARGEM + recuo, y: this.y - tamanho, size: tamanho, font: fonte });
      this.y -= tamanho + 3.5;
    }
    this.y -= opcoes.espaco ?? 6;
    return this;
  }

  /** Lista numerada de cláusulas. */
  clausulas(itens: string[], inicio = 1) {
    itens.forEach((t, i) => this.paragrafo(`CLÁUSULA ${inicio + i}ª — ${t}`, { espaco: 7 }));
    return this;
  }

  campos(pares: [string, string][]) {
    for (const [rotulo, valor] of pares) {
      this.garantir(14);
      const r = `${textoSeguro(rotulo)}: `;
      this.pagina.drawText(r, { x: MARGEM, y: this.y - 10, size: 10, font: this.negrito });
      const w = this.negrito.widthOfTextAtSize(r, 10);
      const linhas = this.quebrar(valor, 10, this.fonte, this.largura - w);
      linhas.forEach((l, i) => {
        if (i > 0) this.garantir(14);
        this.pagina.drawText(l, { x: MARGEM + w, y: this.y - 10, size: 10, font: this.fonte });
        this.y -= 13.5;
      });
    }
    this.y -= 6;
    return this;
  }

  tabela(cabecalho: string[], linhas: string[][], larguras?: number[], opcoes: { tamanho?: number; alinharDireita?: number[] } = {}) {
    const tam = opcoes.tamanho ?? 9;
    const ws = larguras ?? cabecalho.map(() => this.largura / cabecalho.length);
    const desenhar = (cols: string[], fonte: PDFFont, fundo?: boolean) => {
      const altura = tam + 7;
      this.garantir(altura);
      if (fundo) this.pagina.drawRectangle({ x: MARGEM, y: this.y - altura, width: this.largura, height: altura, color: rgb(0.92, 0.94, 0.97) });
      let x = MARGEM;
      cols.forEach((c, i) => {
        let t = textoSeguro(c ?? "");
        while (t.length > 1 && fonte.widthOfTextAtSize(t, tam) > ws[i] - 6) t = t.slice(0, -1);
        const direita = opcoes.alinharDireita?.includes(i);
        const tx = direita ? x + ws[i] - 3 - fonte.widthOfTextAtSize(t, tam) : x + 3;
        this.pagina.drawText(t, { x: tx, y: this.y - tam - 2, size: tam, font: fonte });
        x += ws[i];
      });
      this.pagina.drawLine({ start: { x: MARGEM, y: this.y - altura }, end: { x: MARGEM + this.largura, y: this.y - altura }, thickness: 0.4, color: rgb(0.75, 0.75, 0.75) });
      this.y -= altura;
    };
    desenhar(cabecalho, this.negrito, true);
    for (const l of linhas) desenhar(l, this.fonte);
    this.y -= 8;
    return this;
  }

  /** Linhas de assinatura lado a lado. */
  assinaturas(nomes: { nome: string; papel: string }[]) {
    this.garantir(80);
    this.y -= 40;
    const w = this.largura / nomes.length;
    nomes.forEach((n, i) => {
      const x = MARGEM + i * w + 10;
      this.pagina.drawLine({ start: { x, y: this.y }, end: { x: x + w - 20, y: this.y }, thickness: 0.6 });
      this.pagina.drawText(textoSeguro(n.nome).slice(0, 45), { x, y: this.y - 12, size: 9, font: this.negrito });
      this.pagina.drawText(textoSeguro(n.papel), { x, y: this.y - 23, size: 8, font: this.fonte });
    });
    this.y -= 40;
    return this;
  }

  espaco(px = 10) {
    this.y -= px;
    return this;
  }

  async salvar(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

/** Acrescenta uma página de "manifesto de assinaturas eletrônicas" ao final de um PDF existente. */
export async function anexarManifesto(pdf: Uint8Array, assinaturas: { nome: string; papel: string; data: Date; ip?: string | null; hash: string }[], codigo: string) {
  const doc = await PDFDocument.load(pdf);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const p = doc.addPage(A4);
  let y = A4[1] - MARGEM;
  const linha = (t: string, f = fonte, tam = 10) => {
    p.drawText(textoSeguro(t), { x: MARGEM, y: y - tam, size: tam, font: f });
    y -= tam + 6;
  };
  linha("Registro de assinaturas eletrônicas", negrito, 14);
  linha("Assinatura eletrônica simples (Lei 14.063/2020, art. 4º, I), com identificação do signatário, data, hora e endereço IP.", fonte, 8);
  y -= 6;
  for (const a of assinaturas) {
    linha(`${a.nome} (${a.papel})`, negrito);
    linha(`Assinado em ${a.data.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}${a.ip ? ` — IP ${a.ip}` : ""}`);
    linha(`Hash SHA-256 do documento assinado: ${a.hash}`, fonte, 7);
    y -= 4;
  }
  y -= 10;
  linha(`Código de verificação: ${codigo}`, negrito, 9);
  return doc.save();
}
