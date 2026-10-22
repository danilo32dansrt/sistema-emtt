import QRCode from "qrcode";

/** Matriz do QR Code (true = quadrado preto), usada no PDF e na prévia da tela. */
export function matrizQr(texto: string): boolean[][] {
  const m = QRCode.create(texto, { errorCorrectionLevel: "M" }).modules;
  return Array.from({ length: m.size }, (_, l) => Array.from({ length: m.size }, (_, c) => Boolean(m.get(l, c))));
}
