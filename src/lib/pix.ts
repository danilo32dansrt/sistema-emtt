/**
 * Pix "copia e cola" (BR Code estático) conforme o Manual de Padrões do Pix (EMV QRCPS).
 * Gera o texto para pagamento da mensalidade; o QR Code é desenhado a partir dele.
 */

function campo(id: string, valor: string): string {
  return `${id}${String(valor.length).padStart(2, "0")}${valor}`;
}

/** CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF). */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function limpar(texto: string, max: number): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-]/g, "")
    .toUpperCase()
    .slice(0, max)
    .trim();
}

export function gerarPixCopiaECola(opcoes: { chave: string; nome: string; cidade: string; valor?: number; txid?: string; descricao?: string }): string {
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", opcoes.chave.trim()) + (opcoes.descricao ? campo("02", limpar(opcoes.descricao, 40)) : "");
  const txid = (opcoes.txid ?? "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  let payload =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    (opcoes.valor ? campo("54", opcoes.valor.toFixed(2)) : "") +
    campo("58", "BR") +
    campo("59", limpar(opcoes.nome, 25) || "RECEBEDOR") +
    campo("60", limpar(opcoes.cidade, 15) || "BRASIL") +
    campo("62", campo("05", txid)) +
    "6304";
  payload += crc16(payload);
  return payload;
}
