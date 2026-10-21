/**
 * Regras puras (sem banco e sem rede) da cobrança de mensalidades pela API do Banco Inter (Cobrança v3: boleto com Pix).
 * Referência: especificação oficial em https://developers.inter.co (endpoints /cobranca/v3/cobrancas).
 */

export type SituacaoInter =
  | "RECEBIDO" | "A_RECEBER" | "MARCADO_RECEBIDO" | "ATRASADO" | "CANCELADO" | "EXPIRADO" | "FALHA_EMISSAO" | "EM_PROCESSAMENTO" | "PROTESTO";

export const ROTULOS_SITUACAO_INTER: Record<string, string> = {
  EM_PROCESSAMENTO: "em emissão no banco",
  A_RECEBER: "aguardando pagamento",
  ATRASADO: "vencida no banco",
  RECEBIDO: "paga (confirmado pelo banco)",
  MARCADO_RECEBIDO: "baixada como paga no banco",
  CANCELADO: "cancelada no banco",
  EXPIRADO: "expirada no banco",
  FALHA_EMISSAO: "falha na emissão",
  PROTESTO: "em protesto",
};

/** O que a situação do banco significa para a mensalidade no sistema. */
export function interpretarSituacao(s: string | null | undefined): "PAGO" | "ABERTO" | "CANCELADO" | "FALHA" | "PROCESSANDO" {
  switch (s) {
    case "RECEBIDO":
    case "MARCADO_RECEBIDO":
      return "PAGO";
    case "CANCELADO":
    case "EXPIRADO":
      return "CANCELADO";
    case "FALHA_EMISSAO":
      return "FALHA";
    case "EM_PROCESSAMENTO":
      return "PROCESSANDO";
    default:
      return "ABERTO";
  }
}

/** Cobrança que ainda pode ser paga (e que deve ser cancelada no banco se a baixa for feita por outro meio). */
export const cobrancaAtiva = (s: string | null | undefined) => s === "A_RECEBER" || s === "ATRASADO" || s === "EM_PROCESSAMENTO";

export function formaRecebimento(origem: string | null | undefined): string {
  return origem === "BOLETO" ? "Boleto (Inter)" : origem === "PIX" ? "Pix (Inter)" : "Inter";
}

/** "Seu número" do título: até 15 caracteres, único por mensalidade. */
export function seuNumero(m: { id: string; ano: number; mes: number }): string {
  return `M${m.ano}${String(m.mes).padStart(2, "0")}${m.id.slice(-8).toUpperCase()}`.slice(0, 15);
}

const so = (t: string | null | undefined) => (t ?? "").replace(/\D/g, "");
const corta = (t: string | null | undefined, max: number) => (t ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const isoData = (d: Date) => d.toISOString().slice(0, 10);
const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export interface DadosPedido {
  mensalidade: { id: string; ano: number; mes: number; valor: number; vencimento: Date };
  cliente: { nome: string; cpf: string; email?: string | null; telefone?: string | null; endereco?: string | null; cidade?: string | null; uf?: string | null; cep?: string | null };
  multaPercentual: number;
  jurosMensalPercentual: number;
  diasBaixa: number;
  nomeConsultoria: string;
  hoje: Date;
}

export interface PedidoCobranca {
  seuNumero: string;
  valorNominal: number;
  dataVencimento: string;
  numDiasAgenda: number;
  formasRecebimento: ("BOLETO" | "PIX")[];
  pagador: Record<string, string>;
  multa?: { codigo: "PERCENTUAL"; taxa: number };
  mora?: { codigo: "TAXAMENSAL"; taxa: number };
  mensagem: { linha1: string; linha2?: string };
}

/**
 * Monta o pedido de emissão. O banco exige do pagador: nome, CPF/CNPJ, endereço, cidade, UF e CEP;
 * quando falta algo, devolve a lista para o consultor completar o cadastro do cliente.
 * Mensalidade já vencida é emitida com vencimento hoje (o banco não aceita data passada).
 */
export function montarPedidoCobranca(d: DadosPedido): { ok: true; pedido: PedidoCobranca } | { ok: false; faltando: string[] } {
  const c = d.cliente;
  const doc = so(c.cpf);
  const cep = so(c.cep);
  const uf = corta(c.uf, 2).toUpperCase();
  const faltando: string[] = [];
  if (doc.length !== 11 && doc.length !== 14) faltando.push("CPF/CNPJ");
  if (!corta(c.endereco, 100)) faltando.push("endereço");
  if (!corta(c.cidade, 60)) faltando.push("cidade");
  if (!UFS.includes(uf)) faltando.push("UF");
  if (cep.length !== 8) faltando.push("CEP");
  if (!(d.mensalidade.valor > 0)) faltando.push("valor da mensalidade");
  if (faltando.length) return { ok: false, faltando };

  const pagador: Record<string, string> = { cpfCnpj: doc, tipoPessoa: doc.length === 14 ? "JURIDICA" : "FISICA", nome: corta(c.nome, 100), endereco: corta(c.endereco, 100), cidade: corta(c.cidade, 60), uf, cep };
  const email = corta(c.email, 50);
  if (email.includes("@")) pagador.email = email;
  const fone = so(c.telefone).replace(/^55(?=\d{10,11}$)/, "");
  if (fone.length === 10 || fone.length === 11) {
    pagador.ddd = fone.slice(0, 2);
    pagador.telefone = fone.slice(2);
  }
  const venc = d.mensalidade.vencimento < d.hoje ? d.hoje : d.mensalidade.vencimento;
  const comp = `${String(d.mensalidade.mes).padStart(2, "0")}/${d.mensalidade.ano}`;
  const pedido: PedidoCobranca = {
    seuNumero: seuNumero(d.mensalidade),
    valorNominal: Math.round(d.mensalidade.valor * 100) / 100,
    dataVencimento: isoData(venc),
    numDiasAgenda: Math.min(60, Math.max(0, Math.trunc(d.diasBaixa))),
    formasRecebimento: ["BOLETO", "PIX"],
    pagador,
    mensagem: { linha1: corta(`Mensalidade ${comp} - ${d.nomeConsultoria}`, 78), linha2: "Pague pelo Pix (QR Code) ou pelo codigo de barras." },
  };
  if (d.multaPercentual > 0) pedido.multa = { codigo: "PERCENTUAL", taxa: Math.round(d.multaPercentual * 100) / 100 };
  if (d.jurosMensalPercentual > 0) pedido.mora = { codigo: "TAXAMENSAL", taxa: Math.round(d.jurosMensalPercentual * 100) / 100 };
  return { ok: true, pedido };
}

/** Certificado/chave do .env: aceita o conteúdo PEM direto (com \n escapados) ou o arquivo inteiro em base64. */
export function lerPem(valor: string | undefined): string | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  if (v.includes("-----BEGIN")) return v.replace(/\\n/g, "\n");
  const texto = Buffer.from(v, "base64").toString("utf8");
  return texto.includes("-----BEGIN") ? texto : null;
}
