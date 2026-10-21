"use server";

import { z } from "zod";
import type { EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { conferirSenha, gerarHashSenha, validarForcaSenha } from "@/lib/auth/senha";
import { usuarioAtual } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

export async function trocarSenha(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await usuarioAtual();
  if (!u) return { erro: "Sessão expirada. Entre novamente." };
  const d = z.object({ atual: z.string(), nova: z.string(), confirmacao: z.string() }).safeParse({ atual: fd.get("atual"), nova: fd.get("nova"), confirmacao: fd.get("confirmacao") });
  if (!d.success) return { erro: "Preencha todos os campos." };
  if (d.data.nova !== d.data.confirmacao) return { erro: "A confirmação não confere com a nova senha." };
  const fraca = validarForcaSenha(d.data.nova);
  if (fraca) return { erro: fraca };
  const registro = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
  if (!(await conferirSenha(d.data.atual, registro.senhaHash))) return { erro: "Senha atual incorreta." };
  await prisma.usuario.update({ where: { id: u.id }, data: { senhaHash: await gerarHashSenha(d.data.nova), trocarSenha: false } });
  await registrarAtividade({ usuarioId: u.id, clienteId: u.clienteId, acao: "SENHA_ALTERADA", descricao: `${u.nome} alterou a própria senha` });
  return { ok: true, mensagem: "Senha alterada com sucesso." };
}
