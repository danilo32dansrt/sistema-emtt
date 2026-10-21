"use server";

import { z } from "zod";
import { exigirPapel } from "@/lib/auth/sessao";
import { registrarAtividade } from "@/lib/atividade";
import { hojeBrasil, simularBeneficiosSociais } from "@/lib/calculos";
import { pdfBeneficios } from "@/lib/pdf/beneficios";
import { parametrosSociaisHoje, tabelaNaDataDb } from "@/lib/tabelas-db";

const esquema = z.object({
  nome: z.string().max(100).default(""),
  salarioProposto: z.number().min(0).max(100000),
  recebeBolsaFamilia: z.boolean(),
  valorBolsaFamilia: z.number().min(0).max(10000).optional(),
  pessoas: z.array(z.object({
    nome: z.string().max(100),
    idade: z.number().int().min(0).max(120),
    renda: z.number().min(0).max(100000),
    ehEmpregada: z.boolean().optional(),
    gestante: z.boolean().optional(),
    nutriz: z.boolean().optional(),
    recebeBpc: z.boolean().optional(),
    valorBpc: z.number().min(0).max(100000).optional(),
  })).min(1).max(30),
});

/** Gera o PDF da simulação no servidor (com os parâmetros oficiais vigentes) para enviar por WhatsApp. */
export async function gerarPdfBeneficios(entrada: unknown): Promise<{ pdf?: string; erro?: string }> {
  const u = await exigirPapel("CONSULTOR", "CLIENTE");
  const r = esquema.safeParse(entrada);
  if (!r.success) return { erro: "Dados da simulação inválidos." };
  const hoje = hojeBrasil();
  const [params, { tabela }] = await Promise.all([parametrosSociaisHoje(), tabelaNaDataDb(hoje)]);
  const resultado = simularBeneficiosSociais({ ...r.data, params, tabela });
  const bytes = await pdfBeneficios(resultado, r.data.nome, r.data.salarioProposto);
  await registrarAtividade({ usuarioId: u.id, clienteId: u.clienteId, acao: "SIMULACAO_BENEFICIOS", descricao: "PDF do simulador de benefícios gerado" });
  return { pdf: Buffer.from(bytes).toString("base64") };
}
