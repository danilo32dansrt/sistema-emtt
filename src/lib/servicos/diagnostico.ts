import "server-only";
import {
  competenciaAnterior, diagnosticarCliente, diferencaDias, hojeBrasil, situacaoChecklist, type RegraFeriasParcial,
} from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { configuracao } from "@/lib/tabelas-db";
import { feriasDoEmpregado, validacoesDoEmpregado } from "./empregado";

/** Diagnóstico de riscos trabalhistas de um cliente (nota de 0 a 100 e lista do que corrigir). */
export async function diagnosticoDoCliente(clienteId: string, hoje = hojeBrasil()) {
  const cfg = await configuracao();
  const cliente = await prisma.cliente.findUniqueOrThrow({
    where: { id: clienteId },
    include: {
      empregados: {
        where: { situacao: { not: "DESLIGADO" } },
        include: {
          ferias: true,
          competencias: { orderBy: [{ ano: "desc" }, { mes: "desc" }], take: 12 },
          espelhos: { orderBy: [{ ano: "desc" }, { mes: "desc" }], take: 2 },
          documentos: { where: { tipo: { in: ["CONTRATO_TRABALHO", "ACORDO_COMPENSACAO", "ACORDO_12X36"] } }, include: { assinaturas: true } },
        },
      },
      mensalidades: { where: { status: "ABERTO" } },
    },
  });

  const anterior = competenciaAnterior(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1);
  let daesAtrasados = 0;
  let folhasNaoEncerradas = 0;
  const empregados = [];
  for (const e of cliente.empregados) {
    for (const c of e.competencias) {
      const s = situacaoChecklist(c.ano, c.mes, c, hoje);
      if (s.atrasadas.includes("pagamentoConfirmado")) daesAtrasados++;
      if (s.atrasadas.includes("folhaEncerrada")) folhasNaoEncerradas++;
    }
    const temCompetenciaAnterior = e.competencias.some((c) => c.ano === anterior.ano && c.mes === anterior.mes);
    if (!temCompetenciaAnterior && e.admissao.getTime() < Date.UTC(anterior.ano, anterior.mes - 1, 1)) {
      const s = situacaoChecklist(anterior.ano, anterior.mes, {}, hoje);
      if (s.atrasadas.includes("pagamentoConfirmado")) daesAtrasados++;
    }
    const { periodos } = feriasDoEmpregado(e, cfg.regraFeriasParcial as RegraFeriasParcial, hoje);
    const assinado = (tipo: string) => e.documentos.some((d) => d.tipo === tipo && d.assinaturas.length >= 1);
    const espelhoAnterior = e.espelhos.find((x) => x.ano === anterior.ano && x.mes === anterior.mes);
    empregados.push({
      nome: e.nome,
      validacoes: await validacoesDoEmpregado(e, hoje),
      feriasVencidas: periodos.filter((p) => p.status === "VENCIDO").length,
      feriasVencendo60dias: periodos.filter((p) => p.status === "A_GOZAR" && p.diasParaVencer <= 60).length,
      espelhoAssinadoMesAnterior: e.pontoAtivo ? Boolean(espelhoAnterior?.assinadoEmpregadoEm && espelhoAnterior?.assinadoEmpregadorEm) : null,
      regime: e.regime,
      acordoCompensacaoNecessario: Object.values((e.jornada ?? {}) as Record<string, number>).some((h) => Number(h) > 8),
      temAcordoCompensacao: e.acordoCompensacao,
      acordo12x36Necessario: e.regime === "DOZE_X_TRINTA_SEIS",
      temAcordo12x36: e.acordo12x36,
      temContratoAssinado: assinado("CONTRATO_TRABALHO"),
    });
  }

  const diasProcuracao = cliente.procuracaoValidade ? diferencaDias(hoje, cliente.procuracaoValidade) : null;
  const procuracaoStatus = cliente.procuracaoStatus === "ATIVA" && diasProcuracao !== null && diasProcuracao < 0 ? "VENCIDA" : cliente.procuracaoStatus;
  return diagnosticarCliente({
    procuracaoStatus,
    procuracaoVenceEmDias: diasProcuracao,
    daesAtrasados,
    folhasNaoEncerradas,
    mensalidadesAtrasadas: cliente.mensalidades.filter((m) => m.vencimento < hoje).length,
    empregados,
  });
}
