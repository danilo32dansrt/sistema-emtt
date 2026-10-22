"use server";

import type { EstadoAcao } from "@/lib/acoes";
import { erroParaEstado } from "@/lib/acoes";
import { exigirConsultor } from "@/lib/auth/sessao";
import { enviarAvisosDeTeste, type GrupoTeste } from "@/lib/servicos/avisos-teste";

const NOMES: Record<GrupoTeste, string> = { EMPREGADO: "empregada", CLIENTE: "patrão", CONSULTOR: "consultor" };

/** Manda um exemplo de cada aviso para os celulares escolhidos (consultor, patrão e empregada do cliente). */
export async function testarAvisos(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const clienteId = String(fd.get("clienteId") ?? "");
    if (!clienteId) return { erro: "Escolha o cliente de teste." };
    const grupos = (["EMPREGADO", "CLIENTE", "CONSULTOR"] as GrupoTeste[]).filter((g) => fd.get(g) === "on");
    if (!grupos.length) return { erro: "Marque pelo menos um celular." };
    const r = await enviarAvisosDeTeste({ clienteId, consultorId: u.id, grupos });
    const partes = Object.entries(r).map(([g, v]) => `${NOMES[g as GrupoTeste]}: ${v.avisos} aviso(s), ${v.celulares} celular(es) com avisos ativados${v.pessoas ? "" : " — sem usuário cadastrado"}`);
    return { ok: true, mensagem: `Enviado. ${partes.join(" · ")}.` };
  } catch (e) {
    return erroParaEstado(e);
  }
}
