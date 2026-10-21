"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { exigirConsultor } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { checkbox, dadosDoForm, texto } from "@/lib/formularios";

export async function salvarArtigo(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  try {
    const d = z.object({ id: z.string().optional(), titulo: texto("o título"), categoria: texto("a categoria"), conteudo: texto("o conteúdo"), publico: checkbox }).parse(dadosDoForm(fd));
    const { id, ...dados } = d;
    if (id) await prisma.artigo.update({ where: { id }, data: dados });
    else await prisma.artigo.create({ data: dados });
    revalidatePath("/consultor/conhecimento");
    return { ok: true, mensagem: "Artigo salvo." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function salvarResposta(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  try {
    const d = z.object({ titulo: texto("o título"), texto: texto("o texto"), categoria: z.string().default("Geral") }).parse(dadosDoForm(fd));
    await prisma.respostaPronta.create({ data: d });
    revalidatePath("/consultor/conhecimento");
    return { ok: true, mensagem: "Resposta salva." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function excluirArtigo(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  await prisma.artigo.delete({ where: { id: String(fd.get("id")) } });
  revalidatePath("/consultor/conhecimento");
  return { ok: true };
}
