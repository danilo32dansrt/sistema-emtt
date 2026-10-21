import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { COOKIE_SESSAO, criarToken, DURACAO_SESSAO_HORAS, lerToken, type DadosSessao, type PapelUsuario } from "./token";

export async function iniciarSessao(dados: DadosSessao) {
  const token = await criarToken(dados);
  const jar = await cookies();
  jar.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_HORAS * 3600,
  });
}

export async function encerrarSessao() {
  const jar = await cookies();
  jar.delete(COOKIE_SESSAO);
}

/** Usuário logado (conferido no banco a cada requisição: se for desativado, perde o acesso na hora). */
export const usuarioAtual = cache(async () => {
  const jar = await cookies();
  const sessao = await lerToken(jar.get(COOKIE_SESSAO)?.value);
  if (!sessao) return null;
  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.sub },
    select: { id: true, nome: true, email: true, papel: true, clienteId: true, empregadoId: true, ativo: true, consentimentoLgpdEm: true, trocarSenha: true },
  });
  if (!usuario || !usuario.ativo) return null;
  return usuario;
});

export type UsuarioLogado = NonNullable<Awaited<ReturnType<typeof usuarioAtual>>>;

export async function exigirPapel(...papeis: PapelUsuario[]): Promise<UsuarioLogado> {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  if (!papeis.includes(u.papel)) redirect("/");
  return u;
}

export async function exigirConsultor() {
  return exigirPapel("CONSULTOR");
}

export async function exigirCliente() {
  const u = await exigirPapel("CLIENTE");
  if (!u.clienteId) redirect("/login");
  return u as UsuarioLogado & { clienteId: string };
}

export async function exigirEmpregado() {
  const u = await exigirPapel("EMPREGADO");
  if (!u.empregadoId) redirect("/login");
  return u as UsuarioLogado & { empregadoId: string };
}

export async function ipRequisicao(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent");
}
