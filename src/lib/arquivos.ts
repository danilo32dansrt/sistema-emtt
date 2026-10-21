import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "./db";

export const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB
const TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function sha256(dados: Uint8Array | Buffer | string): string {
  return createHash("sha256").update(dados).digest("hex");
}

/** Salva um arquivo enviado pelo usuário (PDF ou imagem até 5 MB) e devolve o id. */
export async function salvarUpload(arquivo: File | null, opcoes: { clienteId?: string | null; criadoPorId?: string | null; obrigatorio?: boolean }) {
  if (!arquivo || arquivo.size === 0) {
    if (opcoes.obrigatorio) throw new Error("Anexe o arquivo.");
    return null;
  }
  if (arquivo.size > TAMANHO_MAXIMO) throw new Error("O arquivo passa de 5 MB.");
  if (!TIPOS_PERMITIDOS.includes(arquivo.type)) throw new Error("Envie um PDF ou uma foto (JPG, PNG, WEBP).");
  const dados = Buffer.from(await arquivo.arrayBuffer());
  return salvarBytes(dados, { nome: arquivo.name || "arquivo", mime: arquivo.type, ...opcoes });
}

export async function salvarBytes(dados: Uint8Array | Buffer, opcoes: { nome: string; mime: string; clienteId?: string | null; criadoPorId?: string | null }) {
  const buf = Buffer.from(dados);
  const a = await prisma.arquivo.create({
    data: {
      nome: opcoes.nome.slice(0, 200),
      mime: opcoes.mime,
      tamanho: buf.length,
      sha256: sha256(buf),
      dados: buf,
      clienteId: opcoes.clienteId ?? null,
      criadoPorId: opcoes.criadoPorId ?? null,
    },
    select: { id: true, sha256: true },
  });
  return a;
}

/** Converte dataURL (ex.: selfie da câmera) em bytes. */
export function dataUrlParaBytes(dataUrl: string): { mime: string; dados: Buffer } {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Imagem inválida.");
  const dados = Buffer.from(m[2], "base64");
  if (dados.length > TAMANHO_MAXIMO) throw new Error("Imagem muito grande.");
  return { mime: m[1], dados };
}
