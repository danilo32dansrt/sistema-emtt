import { describe, expect, it } from "vitest";
import { crc16, gerarPixCopiaECola } from "./pix";
import { linkWhatsapp, preencherModelo } from "./whatsapp";

describe("Pix copia e cola", () => {
  it("calcula CRC16-CCITT", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
  it("monta payload válido", () => {
    const p = gerarPixCopiaECola({ chave: "consultor@email.com", nome: "Consultoria João", cidade: "São Paulo", valor: 150, txid: "MENS202603" });
    expect(p.startsWith("000201")).toBe(true);
    expect(p).toContain("br.gov.bcb.pix");
    expect(p).toContain("5406150.00");
    expect(p).toContain("CONSULTORIA JOAO");
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });
});

describe("WhatsApp", () => {
  it("preenche modelo e gera link", () => {
    const m = preencherModelo("Olá, [nome]! DAE de [mês] no valor de [valor].", { nome: "Suely", "mês": "fevereiro/2026", valor: "R$ 159,18" });
    expect(m).toBe("Olá, Suely! DAE de fevereiro/2026 no valor de R$ 159,18.");
    expect(linkWhatsapp("(11) 98765-4321", "oi")).toBe("https://wa.me/5511987654321?text=oi");
  });
});
