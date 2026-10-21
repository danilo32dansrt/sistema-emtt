"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAcao } from "@/lib/acoes";
import { usuarioAtual } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

export async function marcarAvisosLidos(): Promise<EstadoAcao> {
  const u = await usuarioAtual();
  if (!u) return { erro: "Faça login." };
  await prisma.notificacao.updateMany({ where: { usuarioId: u.id, lidaEm: null }, data: { lidaEm: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true };
}
