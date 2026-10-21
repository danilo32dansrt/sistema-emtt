import "server-only";
import { request } from "node:https";
import { lerPem, type PedidoCobranca, type SituacaoInter } from "./regras";

/**
 * Cliente da API do Banco Inter PJ (conexão com certificado digital, mTLS, e token OAuth).
 * Credenciais só no .env: INTER_CLIENT_ID, INTER_CLIENT_SECRET, INTER_CERT, INTER_KEY, INTER_AMBIENTE e,
 * se a aplicação tiver mais de uma conta, INTER_CONTA_CORRENTE.
 */

const HOSTS = { producao: "cdpj.partners.bancointer.com.br", sandbox: "cdpj-sandbox.partners.uatinter.co" } as const;
const ESCOPOS = "boleto-cobranca.read boleto-cobranca.write";

export type AmbienteInter = keyof typeof HOSTS;

export function configInter() {
  const ambiente: AmbienteInter = process.env.INTER_AMBIENTE === "producao" ? "producao" : "sandbox";
  const cert = lerPem(process.env.INTER_CERT);
  const key = lerPem(process.env.INTER_KEY);
  const clientId = process.env.INTER_CLIENT_ID?.trim();
  const clientSecret = process.env.INTER_CLIENT_SECRET?.trim();
  const faltando = [!clientId && "INTER_CLIENT_ID", !clientSecret && "INTER_CLIENT_SECRET", !cert && "INTER_CERT", !key && "INTER_KEY"].filter(Boolean) as string[];
  return { ambiente, host: HOSTS[ambiente], cert, key, clientId, clientSecret, conta: process.env.INTER_CONTA_CORRENTE?.replace(/\D/g, "") || undefined, configurado: faltando.length === 0, faltando };
}

export class ErroInter extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

function chamar(metodo: string, caminho: string, opcoes: { corpo?: string; tipo?: string; token?: string } = {}): Promise<{ status: number; texto: string }> {
  const cfg = configInter();
  if (!cfg.configurado) return Promise.reject(new ErroInter(0, `Integração com o Inter não configurada (faltam: ${cfg.faltando.join(", ")}).`));
  const headers: Record<string, string> = {};
  if (opcoes.corpo !== undefined) {
    headers["Content-Type"] = opcoes.tipo ?? "application/json";
    headers["Content-Length"] = String(Buffer.byteLength(opcoes.corpo));
  }
  if (opcoes.token) headers.Authorization = `Bearer ${opcoes.token}`;
  if (cfg.conta) headers["x-conta-corrente"] = cfg.conta;
  return new Promise((resolve, reject) => {
    const req = request({ host: cfg.host, path: caminho, method: metodo, cert: cfg.cert!, key: cfg.key!, headers, timeout: 20000 }, (res) => {
      const partes: Buffer[] = [];
      res.on("data", (p: Buffer) => partes.push(p));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, texto: Buffer.concat(partes).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("O banco demorou para responder.")));
    req.on("error", (e) => reject(new ErroInter(0, `Sem conexão com o Inter: ${e.message}`)));
    if (opcoes.corpo !== undefined) req.write(opcoes.corpo);
    req.end();
  });
}

function mensagemErro(status: number, texto: string): string {
  try {
    const j = JSON.parse(texto) as { title?: string; detail?: string; violacoes?: { razao?: string; propriedade?: string }[] };
    const v = j.violacoes?.map((x) => `${x.propriedade ?? ""} ${x.razao ?? ""}`.trim()).join("; ");
    return [j.title, j.detail, v].filter(Boolean).join(" — ") || `Erro ${status} no Inter.`;
  } catch {
    return `Erro ${status} no Inter${texto ? `: ${texto.slice(0, 200)}` : "."}`;
  }
}

// O token vale 1 hora e o banco limita a 5 pedidos de token por minuto: guardamos e reaproveitamos.
let tokenGuardado: { valor: string; expira: number; chave: string } | null = null;

async function token(): Promise<string> {
  const cfg = configInter();
  const chave = `${cfg.ambiente}:${cfg.clientId}`;
  if (tokenGuardado && tokenGuardado.chave === chave && tokenGuardado.expira > Date.now() + 60_000) return tokenGuardado.valor;
  const corpo = new URLSearchParams({ client_id: cfg.clientId!, client_secret: cfg.clientSecret!, grant_type: "client_credentials", scope: ESCOPOS }).toString();
  const r = await chamar("POST", "/oauth/v2/token", { corpo, tipo: "application/x-www-form-urlencoded" });
  if (r.status !== 200) throw new ErroInter(r.status, r.status === 401 || r.status === 400 ? "O Inter recusou as credenciais (confira Client ID, Client Secret, certificado e permissões de cobrança)." : mensagemErro(r.status, r.texto));
  const j = JSON.parse(r.texto) as { access_token: string; expires_in: number };
  tokenGuardado = { valor: j.access_token, expira: Date.now() + j.expires_in * 1000, chave };
  return j.access_token;
}

async function api<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const r = await chamar(metodo, `/cobranca/v3${caminho}`, { corpo: corpo === undefined ? undefined : JSON.stringify(corpo), token: await token() });
  if (r.status < 200 || r.status >= 300) throw new ErroInter(r.status, mensagemErro(r.status, r.texto));
  return (r.texto ? JSON.parse(r.texto) : {}) as T;
}

export interface CobrancaInter {
  cobranca: { codigoSolicitacao: string; seuNumero: string; situacao: SituacaoInter; dataSituacao?: string; valorTotalRecebido?: string; origemRecebimento?: "BOLETO" | "PIX"; dataVencimento: string; valorNominal: number };
  boleto?: { nossoNumero?: string; codigoBarras: string; linhaDigitavel: string };
  pix?: { txid: string; pixCopiaECola: string };
}

export const emitirCobranca = (p: PedidoCobranca) => api<{ codigoSolicitacao: string }>("POST", "/cobrancas", p);
export const consultarCobranca = (codigo: string) => api<CobrancaInter>("GET", `/cobrancas/${encodeURIComponent(codigo)}`);
export const pdfCobranca = async (codigo: string) => Buffer.from((await api<{ pdf: string }>("GET", `/cobrancas/${encodeURIComponent(codigo)}/pdf`)).pdf, "base64");
export const cancelarCobranca = (codigo: string, motivo: string) => api<unknown>("POST", `/cobrancas/${encodeURIComponent(codigo)}/cancelar`, { motivoCancelamento: motivo.slice(0, 50) });
export const registrarWebhook = (url: string) => api<unknown>("PUT", "/cobrancas/webhook", { webhookUrl: url });
export const consultarWebhook = () => api<{ webhookUrl: string; criacao: string; atualizacao: string }>("GET", "/cobrancas/webhook");
/** Só no ambiente de testes (sandbox): simula o pagamento da cobrança. */
export const pagarCobrancaSandbox = (codigo: string, pagarCom: "BOLETO" | "PIX") => api<unknown>("POST", `/cobrancas/${encodeURIComponent(codigo)}/pagar`, { pagarCom });
