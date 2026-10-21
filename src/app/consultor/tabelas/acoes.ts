"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { exigirConsultor } from "@/lib/auth/sessao";
import { lerMoeda, validarTabela, type TabelaAnual } from "@/lib/calculos";
import { prisma } from "@/lib/db";

export async function salvarTabela(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const ano = z.coerce.number().int().min(2015).max(2100).parse(fd.get("ano"));
    const v = (k: string) => lerMoeda(String(fd.get(k) ?? ""));
    const faixas = [];
    for (let i = 0; i < 6; i++) {
      const ate = String(fd.get(`faixa_ate_${i}`) ?? "").trim();
      const aliq = String(fd.get(`faixa_aliq_${i}`) ?? "").trim();
      if (ate && aliq) faixas.push({ ate: lerMoeda(ate), aliquota: lerMoeda(aliq) });
    }
    const tabela: TabelaAnual = {
      ano,
      salarioMinimo: v("salarioMinimo"),
      faixasInss: faixas,
      salarioFamiliaLimite: v("salarioFamiliaLimite"),
      salarioFamiliaCota: v("salarioFamiliaCota"),
      aliquotas: { inssPatronal: v("inssPatronal"), gilrat: v("gilrat"), fgts: v("fgts"), fgtsCompensatorio: v("fgtsCompensatorio") },
      arredondamentoDae: fd.get("arredondamentoDae") === "arredondar" ? "arredondar" : "truncar",
    };
    const erros = validarTabela(tabela);
    if (erros.length) return { erro: erros.join(" ") };
    const dados = {
      salarioMinimo: tabela.salarioMinimo,
      faixasInss: faixas,
      salarioFamiliaLimite: tabela.salarioFamiliaLimite,
      salarioFamiliaCota: tabela.salarioFamiliaCota,
      ...tabela.aliquotas,
      arredondamentoDae: tabela.arredondamentoDae,
      observacoes: String(fd.get("observacoes") ?? "") || null,
    };
    await prisma.tabelaAnual.upsert({ where: { ano }, create: { ano, ...dados }, update: dados });
    await registrarAtividade({ usuarioId: u.id, acao: "TABELA_ANUAL", descricao: `Tabela de ${ano} salva (salário mínimo ${tabela.salarioMinimo})` });
    revalidatePath("/consultor/tabelas");
    return { ok: true, mensagem: `Tabela de ${ano} salva.` };
  } catch (e) {
    return erroParaEstado(e);
  }
}
