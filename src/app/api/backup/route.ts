import { NextResponse } from "next/server";
import { registrarAtividade } from "@/lib/atividade";
import { usuarioAtual } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

/** Backup completo em JSON (sem o conteúdo binário dos arquivos e sem senhas). */
export async function GET() {
  const u = await usuarioAtual();
  if (!u || u.papel !== "CONSULTOR") return new NextResponse("Não autorizado", { status: 401 });
  const [configuracao, parametros, precos, modelos, clientes, empregados, historico, ferias, afastamentos, competencias, lancamentos, marcacoes, ajustes, justificativas, espelhos, documentos, assinaturas, mensalidades, servicos, leads, ocorrencias, artigos, arquivos, usuarios] = await Promise.all([
    prisma.configuracao.findMany(), prisma.parametro.findMany(), prisma.tabelaPreco.findMany(), prisma.modeloMensagem.findMany(),
    prisma.cliente.findMany(), prisma.empregado.findMany(), prisma.historicoEmpregado.findMany(), prisma.ferias.findMany(), prisma.afastamento.findMany(),
    prisma.competencia.findMany(), prisma.lancamentoMensal.findMany(), prisma.marcacaoPonto.findMany(), prisma.ajustePonto.findMany(), prisma.justificativa.findMany(),
    prisma.espelhoPonto.findMany(), prisma.documento.findMany(), prisma.assinatura.findMany(), prisma.mensalidade.findMany(), prisma.servicoAvulso.findMany(),
    prisma.lead.findMany(), prisma.ocorrenciaDisciplinar.findMany(), prisma.artigo.findMany(),
    prisma.arquivo.findMany({ select: { id: true, nome: true, mime: true, tamanho: true, sha256: true, clienteId: true, criadoEm: true } }),
    prisma.usuario.findMany({ select: { id: true, email: true, nome: true, papel: true, clienteId: true, empregadoId: true, ativo: true, criadoEm: true } }),
  ]);
  await registrarAtividade({ usuarioId: u.id, acao: "EXPORTACAO", descricao: "Backup completo em JSON baixado" });
  const corpo = JSON.stringify({ geradoEm: new Date().toISOString(), versao: 1, configuracao, parametros, fontes: await prisma.fonteOficial.findMany(), precos, modelos, clientes, empregados, historico, ferias, afastamentos, competencias, lancamentos, marcacoes, ajustes, justificativas, espelhos, documentos, assinaturas, mensalidades, servicos, leads, ocorrencias, artigos, arquivos, usuarios }, null, 1);
  return new NextResponse(corpo, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="backup-esocial-${new Date().toISOString().slice(0, 10)}.json"` } });
}
