import type { AlertaValidacao } from "./validacoes";

export interface EmpregadoDiagnostico {
  nome: string;
  validacoes: AlertaValidacao[];
  feriasVencidas: number;
  feriasVencendo60dias: number;
  espelhoAssinadoMesAnterior: boolean | null;
  regime: string;
  acordoCompensacaoNecessario: boolean;
  temAcordoCompensacao: boolean;
  acordo12x36Necessario: boolean;
  temAcordo12x36: boolean;
  temContratoAssinado: boolean;
}

export interface EntradaDiagnostico {
  procuracaoStatus: "PENDENTE" | "ATIVA" | "VENCIDA";
  procuracaoVenceEmDias: number | null;
  folhasNaoEncerradas: number;
  daesAtrasados: number;
  mensalidadesAtrasadas: number;
  empregados: EmpregadoDiagnostico[];
}

export interface ItemDiagnostico {
  codigo: string;
  peso: number;
  gravidade: "alta" | "media" | "baixa";
  mensagem: string;
  comoCorrigir: string;
}

/** Diagnóstico de riscos trabalhistas com nota de conformidade de 0 a 100. */
export function diagnosticarCliente(e: EntradaDiagnostico) {
  const itens: ItemDiagnostico[] = [];
  const add = (codigo: string, peso: number, mensagem: string, comoCorrigir: string) =>
    itens.push({ codigo, peso, gravidade: peso >= 15 ? "alta" : peso >= 7 ? "media" : "baixa", mensagem, comoCorrigir });

  if (e.procuracaoStatus !== "ATIVA") add("PROCURACAO", 10, "Procuração eletrônica não está ativa.", "Pedir ao cliente para cadastrar/renovar a procuração no eSocial.");
  else if (e.procuracaoVenceEmDias !== null && e.procuracaoVenceEmDias <= 30) add("PROCURACAO_VENCENDO", 4, `Procuração vence em ${e.procuracaoVenceEmDias} dia(s).`, "Solicitar a renovação.");
  if (e.daesAtrasados) add("DAE_ATRASO", 20, `${e.daesAtrasados} DAE(s) em atraso.`, "Emitir DAE com acréscimos e confirmar pagamento.");
  if (e.folhasNaoEncerradas) add("FOLHA_ABERTA", 8, `${e.folhasNaoEncerradas} folha(s) não encerrada(s).`, "Encerrar a folha no eSocial.");
  if (e.mensalidadesAtrasadas) add("MENSALIDADE", 3, `${e.mensalidadesAtrasadas} mensalidade(s) da consultoria em atraso.`, "Cobrar o cliente.");

  for (const emp of e.empregados) {
    for (const v of emp.validacoes) {
      if (v.severidade === "info") continue;
      add(`${v.codigo}`, v.severidade === "critico" ? 15 : 6, `${emp.nome}: ${v.mensagem}`, "Revisar o cadastro e o contrato do empregado.");
    }
    if (emp.feriasVencidas) add("FERIAS_VENCIDAS", 20, `${emp.nome}: ${emp.feriasVencidas} período(s) de férias vencido(s) — pagamento em dobro.`, "Conceder as férias imediatamente e pagar em dobro.");
    if (emp.feriasVencendo60dias) add("FERIAS_VENCENDO", 8, `${emp.nome}: férias vencem nos próximos 60 dias.`, "Programar e avisar as férias com 30 dias de antecedência.");
    if (emp.espelhoAssinadoMesAnterior === false) add("PONTO_NAO_ASSINADO", 6, `${emp.nome}: espelho de ponto do mês anterior sem assinatura.`, "Colher a assinatura do empregado e do empregador.");
    if (emp.acordoCompensacaoNecessario && !emp.temAcordoCompensacao) add("SEM_ACORDO_COMPENSACAO", 8, `${emp.nome}: jornada exige acordo escrito de compensação.`, "Gerar e assinar o acordo de compensação.");
    if (emp.acordo12x36Necessario && !emp.temAcordo12x36) add("SEM_ACORDO_12X36", 12, `${emp.nome}: escala 12x36 sem acordo escrito.`, "Gerar e assinar o acordo de 12x36.");
    if (!emp.temContratoAssinado) add("SEM_CONTRATO", 5, `${emp.nome}: contrato de trabalho assinado não arquivado.`, "Gerar o contrato em PDF e colher assinaturas.");
  }

  const nota = Math.max(0, 100 - itens.reduce((t, i) => t + i.peso, 0));
  const classificacao = nota >= 90 ? "Excelente" : nota >= 70 ? "Bom" : nota >= 50 ? "Atenção" : "Crítico";
  return { nota, classificacao, itens: itens.sort((a, b) => b.peso - a.peso) };
}
