"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { exigirPapel } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

export async function enviarMensagem(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirPapel("CONSULTOR", "CLIENTE");
  try {
    const texto = z.string().trim().min(1, "Escreva a mensagem.").max(4000).parse(fd.get("texto"));
    const clienteId = u.papel === "CLIENTE" ? u.clienteId! : z.string().parse(fd.get("clienteId"));
    await prisma.mensagem.create({ data: { clienteId, autorId: u.id, texto } });
    revalidatePath(u.papel === "CLIENTE" ? "/cliente/mensagens" : "/consultor/mensagens");
    return { ok: true };
  } catch (e) {
    return erroParaEstado(e);
  }
}

/** Marca como lidas as mensagens da outra parte. */
export async function marcarLidas(clienteId: string, papelLeitor: "CONSULTOR" | "CLIENTE") {
  await prisma.mensagem.updateMany({ where: { clienteId, lidaEm: null, autor: { papel: papelLeitor === "CONSULTOR" ? "CLIENTE" : "CONSULTOR" } }, data: { lidaEm: new Date() } });
}
