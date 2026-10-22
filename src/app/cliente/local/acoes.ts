"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { exigirCliente } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { RAIOS_PERMITIDOS } from "@/lib/ponto/geo";

/** O patrão marca o centro da casa pelo GPS do celular; a empregada só marca o ponto dentro do raio. */
export async function salvarLocalCasa(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirCliente();
  try {
    const d = z.object({
      latitude: z.coerce.number().min(-90).max(90),
      longitude: z.coerce.number().min(-180).max(180),
      raio: z.coerce.number().refine((r) => (RAIOS_PERMITIDOS as readonly number[]).includes(r), "Raio inválido."),
    }).parse({ latitude: fd.get("latitude"), longitude: fd.get("longitude"), raio: fd.get("raio") });
    await prisma.cliente.update({ where: { id: u.clienteId! }, data: { localLatitude: d.latitude, localLongitude: d.longitude, localRaioMetros: d.raio, localDefinidoEm: new Date() } });
    await registrarAtividade({ usuarioId: u.id, clienteId: u.clienteId, acao: "LOCAL_CASA", descricao: `${u.nome} marcou o local da casa pelo GPS (raio de ${d.raio} m)` });
    revalidatePath("/cliente/local");
    revalidatePath("/cliente");
    return { ok: true, mensagem: `Local da casa salvo. A empregada só marca o ponto a até ${d.raio} m daqui.` };
  } catch (e) {
    return erroParaEstado(e);
  }
}

/** Só muda o raio, mantendo o local marcado. */
export async function salvarRaio(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirCliente();
  const raio = Number(fd.get("raio"));
  if (!(RAIOS_PERMITIDOS as readonly number[]).includes(raio)) return { erro: "Raio inválido." };
  await prisma.cliente.update({ where: { id: u.clienteId! }, data: { localRaioMetros: raio } });
  revalidatePath("/cliente/local");
  return { ok: true, mensagem: `Raio alterado para ${raio} m.` };
}
