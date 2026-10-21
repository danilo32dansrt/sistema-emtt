"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/lib/acoes";
import { conferirSenha } from "@/lib/auth/senha";
import { encerrarSessao, iniciarSessao, ipRequisicao, userAgent, usuarioAtual } from "@/lib/auth/sessao";
import { inicioPorPapel } from "@/lib/auth/token";
import { prisma } from "@/lib/db";
import { registrarAtividade } from "@/lib/atividade";

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

const esquema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe a senha."),
  voltar: z.string().optional(),
});

export async function entrar(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const r = esquema.safeParse({ email: fd.get("email"), senha: fd.get("senha"), voltar: fd.get("voltar") ?? undefined });
  if (!r.success) return { erro: r.error.issues[0].message };
  const { email, senha, voltar } = r.data;
  const ip = await ipRequisicao();
  const ua = await userAgent();

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  const falhar = async (motivo: string, mensagem = "E-mail ou senha incorretos.") => {
    await prisma.acessoLog.create({ data: { email, usuarioId: usuario?.id, sucesso: false, motivo, ip, userAgent: ua } });
    return { erro: mensagem };
  };

  if (!usuario || !usuario.ativo) {
    // Compara com um hash fixo para não revelar se o e-mail existe pelo tempo de resposta
    await conferirSenha(senha, "$2b$12$GBEMkRLC3p6rVT0ikS1fVO7H9biJ0x.KXzvQY5bDgnAF.UqedOaF.");
    return falhar("usuario_inexistente_ou_inativo");
  }
  if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
    return falhar("bloqueado", `Muitas tentativas. Tente novamente após ${usuario.bloqueadoAte.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}.`);
  }
  if (!(await conferirSenha(senha, usuario.senhaHash))) {
    const tentativas = usuario.tentativasFalhas + 1;
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { tentativasFalhas: tentativas >= MAX_TENTATIVAS ? 0 : tentativas, bloqueadoAte: tentativas >= MAX_TENTATIVAS ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60_000) : null },
    });
    return falhar("senha_incorreta");
  }

  await prisma.usuario.update({ where: { id: usuario.id }, data: { tentativasFalhas: 0, bloqueadoAte: null, ultimoAcesso: new Date() } });
  await prisma.acessoLog.create({ data: { email, usuarioId: usuario.id, sucesso: true, ip, userAgent: ua } });
  await registrarAtividade({ usuarioId: usuario.id, clienteId: usuario.clienteId, acao: "LOGIN", descricao: `Acesso de ${usuario.nome}` });
  await iniciarSessao({ sub: usuario.id, papel: usuario.papel, nome: usuario.nome, clienteId: usuario.clienteId, empregadoId: usuario.empregadoId });

  const inicio = inicioPorPapel(usuario.papel);
  redirect(voltar && voltar.startsWith(inicio) ? voltar : usuario.trocarSenha ? `${inicio}/conta` : inicio);
}

export async function sair() {
  const u = await usuarioAtual();
  if (u) await registrarAtividade({ usuarioId: u.id, clienteId: u.clienteId, acao: "LOGOUT", descricao: `Saída de ${u.nome}` });
  await encerrarSessao();
  redirect("/login");
}
