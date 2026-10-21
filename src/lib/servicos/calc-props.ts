import "server-only";
import type { EmpregadoCalc } from "@/components/calc/tipos";
import { hojeBrasil, isoData } from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { configuracao, todasTabelas } from "@/lib/tabelas-db";

/** Dados para as calculadoras/simuladores (todos os clientes ou só um). */
export async function propsCalculadora(clienteId?: string) {
  const [tabelas, cfg, empregados] = await Promise.all([
    todasTabelas(),
    configuracao(),
    prisma.empregado.findMany({
      where: { cliente: { anonimizadoEm: null, ...(clienteId ? { id: clienteId } : {}) } },
      include: { cliente: { select: { nome: true } }, ferias: true },
      orderBy: [{ situacao: "asc" }, { nome: "asc" }],
    }),
  ]);
  const lista: EmpregadoCalc[] = empregados.map((e) => ({
    id: e.id,
    nome: e.nome,
    cliente: e.cliente.nome,
    salario: num(e.salario),
    horasSemanais: num(e.horasSemanais),
    regime: e.regime,
    admissao: isoData(e.admissao),
    desligamento: e.desligamento ? isoData(e.desligamento) : null,
    dependentes: e.dependentesSalarioFamilia,
    valeTransporte: num(e.custoValeTransporte),
    diasExperiencia: e.diasExperiencia,
    estabilidadeAte: e.estabilidadeAte ? isoData(e.estabilidadeAte) : null,
    estabilidadeMotivo: e.estabilidadeMotivo,
    feriasGozadas: e.ferias.map((f) => ({ inicioAquisitivo: isoData(f.inicioAquisitivo), dias: f.dias + f.diasAbono })),
  }));
  return {
    tabelas,
    empregados: lista,
    regraFeriasParcial: (cfg.regraFeriasParcial === "LC150" ? "LC150" : "CLT") as "CLT" | "LC150",
    selicMensal: num(cfg.selicMensal),
    hoje: isoData(hojeBrasil()),
  };
}
