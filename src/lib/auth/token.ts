import { jwtVerify, SignJWT } from "jose";

/** Funções de token usadas também no middleware (Edge), sem dependência do banco. */

export const COOKIE_SESSAO = "sessao";
export const DURACAO_SESSAO_HORAS = 12;

export type PapelUsuario = "CONSULTOR" | "CLIENTE" | "EMPREGADO";

export interface DadosSessao {
  sub: string;
  papel: PapelUsuario;
  nome: string;
  clienteId?: string | null;
  empregadoId?: string | null;
}

function segredo(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("Defina AUTH_SECRET no arquivo .env com pelo menos 32 caracteres.");
  }
  return new TextEncoder().encode(s);
}

export async function criarToken(dados: DadosSessao): Promise<string> {
  return new SignJWT({ papel: dados.papel, nome: dados.nome, clienteId: dados.clienteId ?? null, empregadoId: dados.empregadoId ?? null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(dados.sub)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_HORAS}h`)
    .sign(segredo());
}

export async function lerToken(token: string | undefined): Promise<DadosSessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      papel: payload.papel as PapelUsuario,
      nome: String(payload.nome ?? ""),
      clienteId: (payload.clienteId as string | null) ?? null,
      empregadoId: (payload.empregadoId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export function inicioPorPapel(papel: PapelUsuario): string {
  return papel === "CONSULTOR" ? "/consultor" : papel === "CLIENTE" ? "/cliente" : "/ponto";
}
