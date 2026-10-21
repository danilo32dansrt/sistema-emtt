"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { exigirConsultor } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

/**
 * Exclusão a pedido (LGPD, art. 18, VI): anonimiza os dados pessoais do cliente e dos seus
 * empregados, apaga documentos, arquivos, mensagens e acessos. Os registros de ponto são
 * mantidos (guarda legal de 5 anos), mas deixam de ser ligados a nomes e CPFs.
 */
export async function excluirDadosCliente(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = z.object({ clienteId: z.string(), confirmacao: z.string() }).parse({ clienteId: fd.get("clienteId"), confirmacao: fd.get("confirmacao") });
    const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: d.clienteId } });
    if (d.confirmacao.trim().toUpperCase() !== "EXCLUIR") return { erro: 'Digite EXCLUIR para confirmar.' };
    const codigo = cliente.id.slice(-6).toUpperCase();
    await prisma.$transaction(async (tx) => {
      await tx.usuario.deleteMany({ where: { clienteId: cliente.id } });
      await tx.mensagem.deleteMany({ where: { clienteId: cliente.id } });
      await tx.documento.deleteMany({ where: { clienteId: cliente.id } });
      await tx.arquivo.deleteMany({ where: { clienteId: cliente.id } });
      const emps = await tx.empregado.findMany({ where: { clienteId: cliente.id } });
      for (const [i, e] of emps.entries()) {
        await tx.empregado.update({ where: { id: e.id }, data: { nome: `Empregado anonimizado ${codigo}-${i + 1}`, cpf: "00000000000", nascimento: null, telefone: null, observacoes: null, pontoAtivo: false, situacao: "DESLIGADO" } });
        await tx.historicoEmpregado.deleteMany({ where: { empregadoId: e.id } });
        await tx.justificativa.updateMany({ where: { empregadoId: e.id }, data: { descricao: "(anonimizado)", arquivoId: null } });
      }
      await tx.ocorrenciaDisciplinar.updateMany({ where: { clienteId: cliente.id }, data: { descricao: "(anonimizado)", versaoEmpregado: null, testemunhas: null, provasIds: [] } });
      await tx.cliente.update({ where: { id: cliente.id }, data: { nome: `Cliente anonimizado ${codigo}`, cpf: "00000000000", telefone: null, email: null, endereco: null, cep: null, observacoes: null, ativo: false, anonimizadoEm: new Date() } });
    });
    await registrarAtividade({ usuarioId: u.id, acao: "EXCLUSAO_LGPD", descricao: `Dados do cliente ${codigo} anonimizados a pedido (LGPD)` });
    revalidatePath("/consultor");
    return { ok: true, mensagem: `Dados anonimizados. Código do registro: ${codigo}.` };
  } catch (e) {
    return erroParaEstado(e);
  }
}
