"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { iniciarSessao } from "@/lib/auth/sessao";
import { gerarHashSenha } from "@/lib/auth/senha";
import { prisma } from "@/lib/db";

/**
 * Primeiro acesso depois de publicar: cria a conta do consultor pelo navegador (sem comandos).
 * Só funciona enquanto não existir nenhum consultor cadastrado.
 */
export async function criarPrimeiroConsultor(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  try {
    if (await prisma.usuario.count({ where: { papel: "CONSULTOR" } })) return { erro: "O primeiro acesso já foi feito. Entre pela tela de login." };
    const d = z.object({
      nome: z.string().trim().min(3, "Informe o seu nome."),
      email: z.string().trim().toLowerCase().email("E-mail inválido."),
      senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
      confirmar: z.string(),
    }).parse({ nome: fd.get("nome"), email: fd.get("email"), senha: fd.get("senha"), confirmar: fd.get("confirmar") });
    if (d.senha !== d.confirmar) return { erro: "As senhas não conferem." };
    const u = await prisma.usuario.create({ data: { nome: d.nome, email: d.email, senhaHash: await gerarHashSenha(d.senha), papel: "CONSULTOR" } });
    await prisma.configuracao.upsert({ where: { id: "principal" }, create: { id: "principal" }, update: {} });
    await registrarAtividade({ usuarioId: u.id, acao: "PRIMEIRO_ACESSO", descricao: `Conta do consultor ${d.nome} criada no primeiro acesso` });
    await iniciarSessao({ sub: u.id, papel: u.papel, nome: u.nome, clienteId: null, empregadoId: null });
  } catch (e) {
    return erroParaEstado(e);
  }
  redirect("/consultor/configuracoes");
}
