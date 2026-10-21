import "server-only";
import { addDias, gerarAgenda, hojeBrasil, type Evento } from "@/lib/calculos";
import { prisma } from "@/lib/db";

/** Monta a agenda (vencimentos e alertas) a partir do banco, opcionalmente de um só cliente. */
export async function agendaDoBanco(opcoes: { de?: Date; ate?: Date; clienteId?: string; hoje?: Date } = {}): Promise<Evento[]> {
  const hoje = opcoes.hoje ?? hojeBrasil();
  const de = opcoes.de ?? addDias(hoje, -7);
  const ate = opcoes.ate ?? addDias(hoje, 60);
  const clientes = await prisma.cliente.findMany({
    where: { ativo: true, anonimizadoEm: null, ...(opcoes.clienteId ? { id: opcoes.clienteId } : {}) },
    select: {
      id: true,
      nome: true,
      procuracaoValidade: true,
      empregados: {
        where: { situacao: { not: "DESLIGADO" } },
        select: {
          id: true, nome: true, admissao: true, situacao: true, diasExperiencia: true, estabilidadeAte: true, estabilidadeMotivo: true,
          ferias: { select: { inicioAquisitivo: true, inicioGozo: true, dias: true } },
        },
      },
    },
  });
  return gerarAgenda({
    hoje,
    de,
    ate,
    clientes: clientes.map((c) => ({ id: c.id, nome: c.nome, procuracaoValidade: c.procuracaoValidade, temEmpregadoAtivo: c.empregados.length > 0 })),
    empregados: clientes.flatMap((c) =>
      c.empregados.map((e) => ({
        id: e.id,
        nome: e.nome,
        clienteId: c.id,
        clienteNome: c.nome,
        admissao: e.admissao,
        ativo: true,
        diasExperiencia: e.diasExperiencia,
        estabilidadeAte: e.estabilidadeAte,
        estabilidadeMotivo: e.estabilidadeMotivo,
        feriasGozadas: e.ferias.map((f) => ({ inicioAquisitivo: f.inicioAquisitivo, dias: f.dias })),
        feriasProgramadas: e.ferias.filter((f) => f.inicioGozo >= addDias(hoje, -1)).map((f) => ({ inicio: f.inicioGozo, dias: f.dias })),
      })),
    ),
  });
}
