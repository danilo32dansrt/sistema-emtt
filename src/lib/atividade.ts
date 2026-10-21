import "server-only";
import { prisma } from "./db";
import { ipRequisicao } from "./auth/sessao";

/** Registra no histórico de atividades (o que foi feito, por quem e em qual cliente). */
export async function registrarAtividade(dados: {
  usuarioId?: string | null;
  clienteId?: string | null;
  acao: string;
  descricao: string;
  entidade?: string;
  entidadeId?: string;
}) {
  try {
    await prisma.atividade.create({ data: { ...dados, ip: await ipRequisicao() } });
  } catch (e) {
    console.error("Falha ao registrar atividade", e);
  }
}
