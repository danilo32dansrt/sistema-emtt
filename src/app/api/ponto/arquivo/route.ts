import { NextResponse, type NextRequest } from "next/server";
import { registrarAtividade } from "@/lib/atividade";
import { usuarioAtual } from "@/lib/auth/sessao";
import { addDias, agruparJornadas, data, ultimoDiaMes } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { gerarAej, gerarAfd } from "@/lib/ponto/afd";

/** Exporta AFD/AEJ do mês de um empregado (consultor ou o próprio empregador). */
export async function GET(req: NextRequest) {
  const u = await usuarioAtual();
  if (!u || u.papel === "EMPREGADO") return new NextResponse("Não autorizado", { status: 401 });
  const sp = req.nextUrl.searchParams;
  const emp = await prisma.empregado.findUnique({ where: { id: sp.get("empregado") ?? "" }, include: { cliente: true } });
  if (!emp || (u.papel === "CLIENTE" && emp.clienteId !== u.clienteId)) return new NextResponse("Não encontrado", { status: 404 });
  const ano = Number(sp.get("ano"));
  const mes = Number(sp.get("mes"));
  const inicio = data(ano, mes, 1);
  const fim = ultimoDiaMes(ano, mes);
  const marcacoes = await prisma.marcacaoPonto.findMany({ where: { empregadoId: emp.id, dataHora: { gte: new Date(inicio.getTime() + 3 * 3600_000), lt: new Date(addDias(fim, 1).getTime() + 3 * 3600_000) } }, orderBy: { nsr: "asc" } });
  const empregador = { cpf: emp.cliente.cpf, nome: emp.cliente.nome, local: emp.cliente.endereco ?? "" };
  const tipo = sp.get("tipo") === "AEJ" ? "AEJ" : "AFD";
  const conteudo = tipo === "AFD"
    ? gerarAfd({ empregador, identificadorRep: "SISTEMAESOCIALDOM", inicio, fim, marcacoes: marcacoes.map((m) => ({ nsr: m.nsr, dataHora: m.dataHora, recebidoEm: m.recebidoEm, cpf: emp.cpf, origem: m.origem, hash: m.hash })) })
    : gerarAej({ empregador, inicio, fim, empregados: [{ cpf: emp.cpf, nome: emp.nome, jornadas: agruparJornadas(marcacoes.map((m) => m.dataHora)) }] });
  await registrarAtividade({ usuarioId: u.id, clienteId: emp.clienteId, acao: `EXPORTAR_${tipo}`, descricao: `${tipo} de ${emp.nome} (${mes}/${ano}) exportado` });
  return new NextResponse(conteudo, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${tipo}_${emp.cpf}_${ano}${String(mes).padStart(2, "0")}.txt"` } });
}
