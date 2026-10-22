import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { DocPdf } from "./base";
import { infoPdf, montarPdfAssinado } from "./carimbo";

async function contrato() {
  const d = await DocPdf.criar({ titulo: "Contrato de teste" });
  d.paragrafo("Texto do contrato.");
  d.assinaturas([{ nome: "Suely Exemplo", papel: "Empregador(a)" }, { nome: "Maria Exemplo", papel: "Empregado(a)" }]);
  d.assinaturas([{ nome: "Testemunha 1", papel: "Nome e CPF" }]);
  return d.salvar();
}

describe("PDF com carimbo de assinatura", () => {
  it("grava no PDF onde ficam as linhas de assinatura", async () => {
    const { paginas, locais } = await infoPdf(await contrato());
    expect(paginas).toHaveLength(1);
    expect(locais.map((l) => l.papel)).toEqual(["Empregador(a)", "Empregado(a)", "Nome e CPF"]);
    expect(locais[0].pagina).toBe(0);
  });

  it("desenha os carimbos e acrescenta a página de registro, sem mexer nas páginas originais", async () => {
    const original = await contrato();
    const saida = await montarPdfAssinado(
      original,
      [
        { usuarioId: "u1", nome: "Suely Exemplo", papel: "CLIENTE", data: new Date("2026-10-22T17:00:00Z"), hash: "abc" },
        { usuarioId: "u2", nome: "Consultoria", papel: "CONSULTOR", data: new Date("2026-10-22T17:01:00Z"), hash: "abc" },
      ],
      { u1: { pagina: 0, x: 0.5, y: 0.2 } },
      { codigo: "doc123", endereco: "https://exemplo.com.br" },
    );
    const doc = await PDFDocument.load(saida);
    expect(doc.getPageCount()).toBe(2);
    // o arquivo original continua o mesmo (o hash assinado é o dele)
    expect((await PDFDocument.load(original)).getPageCount()).toBe(1);
  });

  it("documento antigo, sem linhas gravadas, também funciona", async () => {
    const velho = await (await PDFDocument.create()).save();
    const vazio = await PDFDocument.load(velho);
    vazio.addPage();
    const bytes = await vazio.save();
    expect((await infoPdf(bytes)).locais).toEqual([]);
  });
});
