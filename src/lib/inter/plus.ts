/**
 * Planos da consultoria e regras puras do plano Plus (cobrança única mensalidade + DAE e pagamento
 * do DAE pela consultoria, por conta e ordem do cliente, com o dinheiro recebido dele).
 */

export type Plano = "BASICO" | "MEDIO" | "PLUS";

export const PLANOS: Record<Plano, { nome: string; resumo: string; itens: string[] }> = {
  BASICO: {
    nome: "Básico",
    resumo: "O empregador faz a maior parte: informa o mês e paga o DAE e a mensalidade.",
    itens: ["App de ponto da empregada e avisos", "Folha, DAE e recibos feitos pelo consultor", "Empregador informa faltas e extras", "Empregador paga o DAE e avisa “Já paguei”", "Mensalidade por Pix ou boleto"],
  },
  MEDIO: {
    nome: "Médio",
    resumo: "Mais integração: o mês vem do ponto e o sistema cobra e lembra tudo.",
    itens: ["Tudo do Básico", "Faltas e extras vêm direto do ponto", "Cobrança automática da mensalidade (baixa sozinha)", "Lembretes até o DAE ser pago", "Gestão disciplinar, simuladores e documentos completos"],
  },
  PLUS: {
    nome: "Plus",
    resumo: "O empregador só fecha o ponto do mês e mantém dinheiro na conta: a consultoria paga o DAE.",
    itens: ["Tudo do Médio", "Uma cobrança só por mês: mensalidade + DAE", "A consultoria paga o DAE por você, com o dinheiro recebido", "Comprovante do DAE no portal", "Sua única tarefa: fechar o ponto do mês"],
  },
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const dia = (ano: number, mes: number, d: number) => new Date(Date.UTC(ano, mes - 1, d));
const centavos = (v: number) => Math.round(v * 100);

export interface DaeDoMes {
  empregado: string;
  /** DAE já emitido pelo consultor, com valor e código de barras. */
  emitido: boolean;
  valor: number;
}

/**
 * Composição da cobrança única do Plus. Só pode ser emitida quando todos os DAEs do mês estiverem
 * prontos (senão o valor mudaria depois de o cliente pagar).
 */
export function composicaoCobrancaPlus(mensalidade: number, daes: DaeDoMes[]) {
  const valorDae = daes.filter((d) => d.emitido).reduce((t, d) => t + centavos(d.valor), 0) / 100;
  return {
    pronta: daes.length > 0 && daes.every((d) => d.emitido),
    faltando: daes.filter((d) => !d.emitido).map((d) => d.empregado),
    valorDae,
    total: (centavos(mensalidade) + centavos(valorDae)) / 100,
  };
}

/**
 * Vencimento da cobrança única: dia combinado (padrão 5) do mês do vencimento do DAE, sempre antes do DAE
 * (para a consultoria ter tempo de pagar). Se já passou, vence hoje.
 */
export function vencimentoCobrancaPlus(hoje: Date, vencimentoDae: Date, diaCombinado: number): Date {
  let v = dia(vencimentoDae.getUTCFullYear(), vencimentoDae.getUTCMonth() + 1, diaCombinado);
  const limite = new Date(vencimentoDae.getTime() - 86_400_000);
  if (v > limite) v = limite;
  return v < hoje ? hoje : v;
}

/**
 * Data para agendar o pagamento do DAE: no vencimento (o dinheiro já está na conta da consultoria).
 * DAE vencido não pode ser pago com o código antigo: o valor muda com multa e juros e é preciso emitir nova guia.
 */
export function dataPagamentoDae(hoje: Date, vencimentoDae: Date): { ok: true; data: string } | { ok: false; erro: string } {
  if (vencimentoDae < hoje) return { ok: false, erro: "O DAE venceu: emita uma nova guia no eSocial (com multa e juros) e atualize o código de barras." };
  return { ok: true, data: iso(vencimentoDae) };
}

/** Código de barras ou linha digitável do DAE (44 a 48 números). */
export function codigoBarrasValido(codigo: string | null | undefined): string | null {
  const so = (codigo ?? "").replace(/\D/g, "");
  return so.length >= 44 && so.length <= 48 ? so : null;
}

export type StatusPagamentoDae = "AGUARDANDO_RECURSO" | "PRONTO" | "AGENDADO" | "AGUARDANDO_APROVACAO" | "PAGO" | "FALHA" | "CANCELADO";

export const ROTULOS_PAGAMENTO_DAE: Record<StatusPagamentoDae, string> = {
  AGUARDANDO_RECURSO: "aguardando o cliente pagar",
  PRONTO: "dinheiro recebido — falta pagar",
  AGENDADO: "pagamento agendado no Inter",
  AGUARDANDO_APROVACAO: "aguardando sua aprovação no Inter",
  PAGO: "DAE pago",
  FALHA: "falhou — verificar",
  CANCELADO: "cancelado",
};

/** Situação do pagamento no Inter (API Banking) → situação do DAE no sistema. */
export function statusPorSituacaoInter(s: string | null | undefined): StatusPagamentoDae {
  switch (s) {
    case "REALIZADO":
      return "PAGO";
    case "AGUARDANDO_APROVACAO":
      return "AGUARDANDO_APROVACAO";
    case "AGENDADO":
    case "APROVADO":
    case "EMPROCESSAMENTO":
      return "AGENDADO";
    case "CANCELADO":
    case "AGENDADO_CANCELADO":
      return "CANCELADO";
    default:
      return "FALHA";
  }
}
