"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { exigirConsultor } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { dadosDoForm, moeda, texto, textoOpcional } from "@/lib/formularios";

export async function salvarConfiguracao(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = z.object({
      nomeConsultoria: texto("o nome da consultoria"),
      documento: textoOpcional, telefone: textoOpcional, email: textoOpcional, endereco: textoOpcional, cidade: textoOpcional, uf: textoOpcional,
      chavePix: textoOpcional, nomePix: textoOpcional, cidadePix: textoOpcional,
      regraFeriasParcial: z.enum(["CLT", "LC150"]),
    }).parse(dadosDoForm(fd));
    await prisma.configuracao.upsert({ where: { id: "principal" }, create: { id: "principal", ...d }, update: d });
    await registrarAtividade({ usuarioId: u.id, acao: "CONFIGURACAO", descricao: "Configurações da consultoria alteradas" });
    revalidatePath("/consultor/configuracoes");
    return { ok: true, mensagem: "Configurações salvas." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function salvarPreco(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  try {
    const d = z.object({ servico: texto("o serviço"), descricao: textoOpcional, valor: moeda("valor"), unidade: z.enum(["mensal", "por_empregado", "avulso"]) }).parse(dadosDoForm(fd));
    await prisma.tabelaPreco.upsert({ where: { servico: d.servico }, create: d, update: { ...d, ativo: true } });
    revalidatePath("/consultor/configuracoes");
    return { ok: true, mensagem: "Preço salvo." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function removerPreco(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  await prisma.tabelaPreco.update({ where: { id: String(fd.get("id")) }, data: { ativo: false } });
  revalidatePath("/consultor/configuracoes");
  return { ok: true };
}

export async function salvarModelo(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  try {
    const d = z.object({ chave: texto("a chave"), titulo: texto("o título"), texto: texto("o texto") }).parse(dadosDoForm(fd));
    await prisma.modeloMensagem.upsert({ where: { chave: d.chave }, create: d, update: d });
    revalidatePath("/consultor/configuracoes");
    return { ok: true, mensagem: "Modelo salvo." };
  } catch (e) {
    return erroParaEstado(e);
  }
}
