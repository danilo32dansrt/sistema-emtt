import { NextResponse, type NextRequest } from "next/server";
import { registrarAtividade } from "@/lib/atividade";
import { usuarioAtual } from "@/lib/auth/sessao";
import { formatarCompetencia } from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { gerarCsv } from "@/lib/csv";
import { prisma } from "@/lib/db";

/** Exportação de dados em planilha (CSV que abre no Excel). Só o consultor. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ entidade: string }> }) {
  const u = await usuarioAtual();
  if (!u || u.papel !== "CONSULTOR") return new NextResponse("Não autorizado", { status: 401 });
  const { entidade } = await params;
  const sp = req.nextUrl.searchParams;
  let csv: string;
  switch (entidade) {
    case "clientes": {
      const l = await prisma.cliente.findMany({ where: { anonimizadoEm: null }, orderBy: { nome: "asc" } });
      csv = gerarCsv(["Nome", "CPF", "Telefone", "E-mail", "Endereço", "Cidade", "UF", "Início contrato", "Mensalidade", "Vencimento", "Procuração", "Validade procuração", "Ativo"], l.map((c) => [c.nome, c.cpf, c.telefone, c.email, c.endereco, c.cidade, c.uf, c.inicioContrato, num(c.mensalidade), c.diaVencimento, c.procuracaoStatus, c.procuracaoValidade, c.ativo ? "sim" : "não"]));
      break;
    }
    case "empregados": {
      const l = await prisma.empregado.findMany({ where: { cliente: { anonimizadoEm: null } }, include: { cliente: { select: { nome: true } } }, orderBy: { nome: "asc" } });
      csv = gerarCsv(["Empregador", "Nome", "CPF", "Nascimento", "Função", "CBO", "Admissão", "Salário", "Regime", "Horas semanais", "Situação", "Desligamento"], l.map((e) => [e.cliente.nome, e.nome, e.cpf, e.nascimento, e.funcao, e.cbo, e.admissao, num(e.salario), e.regime, num(e.horasSemanais), e.situacao, e.desligamento]));
      break;
    }
    case "rotina": {
      const l = await prisma.competencia.findMany({ include: { empregado: { select: { nome: true, cliente: { select: { nome: true } } } } }, orderBy: [{ ano: "desc" }, { mes: "desc" }] });
      csv = gerarCsv(["Competência", "Empregador", "Empregado", "Info recebida", "Folha lançada", "Folha encerrada", "DAE emitido", "Valor DAE", "Enviado", "Pago", "Recibo arquivado"], l.map((c) => [formatarCompetencia(c.ano, c.mes), c.empregado.cliente.nome, c.empregado.nome, c.infoRecebida ? "sim" : "não", c.folhaLancada ? "sim" : "não", c.folhaEncerrada ? "sim" : "não", c.daeEmitido ? "sim" : "não", c.daeValor ? num(c.daeValor) : null, c.daeEnviado ? "sim" : "não", c.pagamentoConfirmado ? "sim" : "não", c.reciboArquivado ? "sim" : "não"]));
      break;
    }
    case "financeiro": {
      const ano = Number(sp.get("ano")) || undefined;
      const mes = Number(sp.get("mes")) || undefined;
      const l = await prisma.mensalidade.findMany({ where: { ...(ano ? { ano } : {}), ...(mes ? { mes } : {}) }, include: { cliente: { select: { nome: true } } }, orderBy: [{ ano: "desc" }, { mes: "desc" }] });
      csv = gerarCsv(["Competência", "Cliente", "Valor", "Vencimento", "Situação", "Pago em", "Forma"], l.map((m) => [formatarCompetencia(m.ano, m.mes), m.cliente.nome, num(m.valor), m.vencimento, m.status, m.pagoEm, m.formaPagamento]));
      break;
    }
    case "marcacoes": {
      const l = await prisma.marcacaoPonto.findMany({ include: { empregado: { select: { nome: true, cpf: true } } }, orderBy: { nsr: "asc" } });
      csv = gerarCsv(["NSR", "Empregado", "CPF", "Tipo", "Data/hora", "Recebida em", "Origem", "Latitude", "Longitude", "Hash"], l.map((m) => [m.nsr, m.empregado.nome, m.empregado.cpf, m.tipo, m.dataHora.toISOString(), m.recebidoEm.toISOString(), m.origem, m.latitude, m.longitude, m.hash]));
      break;
    }
    default:
      return new NextResponse("Exportação desconhecida", { status: 404 });
  }
  await registrarAtividade({ usuarioId: u.id, acao: "EXPORTACAO", descricao: `Exportação de ${entidade} em planilha` });
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${entidade}-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
