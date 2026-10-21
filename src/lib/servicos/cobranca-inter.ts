import "server-only";
import { registrarAtividade } from "../atividade";
import { formatarCompetencia, formatarData, formatarMoeda, hojeBrasil, lerData } from "../calculos";
import { num } from "../conversao";
import { prisma } from "../db";
import { enviarEmail } from "../email";
import { cancelarCobranca, configInter, consultarCobranca, emitirCobranca } from "../inter/api";
import { cobrancaAtiva, formaRecebimento, interpretarSituacao, montarPedidoCobranca } from "../inter/regras";
import { configuracao } from "../tabelas-db";

/** Cobrança automática ligada nas configurações e credenciais do Inter presentes no .env. */
export async function cobrancaInterAtiva(): Promise<boolean> {
  return (await configuracao()).cobrancaInter && configInter().configurado;
}

/** Emite (ou reaproveita) a cobrança Pix + boleto da mensalidade no Inter. */
export async function emitirCobrancaMensalidade(id: string, usuarioId?: string | null) {
  const [m, cfg] = await Promise.all([prisma.mensalidade.findUniqueOrThrow({ where: { id }, include: { cliente: true } }), configuracao()]);
  if (m.status !== "ABERTO") throw new Error("Só é possível emitir cobrança de mensalidade em aberto.");
  if (m.interCodigo && cobrancaAtiva(m.interSituacao)) return m;
  const r = montarPedidoCobranca({
    mensalidade: { id: m.id, ano: m.ano, mes: m.mes, valor: num(m.valor), vencimento: m.vencimento },
    cliente: m.cliente,
    multaPercentual: num(cfg.multaMensalidade),
    jurosMensalPercentual: num(cfg.jurosMensalidade),
    diasBaixa: cfg.diasBaixaInter,
    nomeConsultoria: cfg.nomeConsultoria,
    hoje: hojeBrasil(),
  });
  if (!r.ok) {
    const erro = `Complete no cadastro do cliente: ${r.faltando.join(", ")}.`;
    await prisma.mensalidade.update({ where: { id }, data: { interErro: erro } });
    throw new Error(erro);
  }
  try {
    const { codigoSolicitacao } = await emitirCobranca(r.pedido);
    await prisma.mensalidade.update({ where: { id }, data: { interCodigo: codigoSolicitacao, interSituacao: "EM_PROCESSAMENTO", interErro: null, linhaDigitavel: null, pixCopiaECola: null, interAtualizadoEm: new Date() } });
    await registrarAtividade({ usuarioId, clienteId: m.clienteId, acao: "COBRANCA_INTER", descricao: `Cobrança Pix/boleto da mensalidade ${formatarCompetencia(m.ano, m.mes)} emitida no Inter` });
  } catch (e) {
    await prisma.mensalidade.update({ where: { id }, data: { interErro: e instanceof Error ? e.message : "Falha ao emitir no Inter." } });
    throw e;
  }
  // O banco processa a emissão em segundos; já tenta trazer o Pix e a linha digitável
  return (await sincronizarMensalidade(id).catch(() => null))?.mensalidade ?? prisma.mensalidade.findUniqueOrThrow({ where: { id } });
}

/**
 * Consulta a cobrança no banco e atualiza a mensalidade. É a única forma de dar baixa automática:
 * o aviso do webhook só dispara esta consulta (nunca confiamos no conteúdo do aviso em si).
 */
export async function sincronizarMensalidade(id: string) {
  const m = await prisma.mensalidade.findUniqueOrThrow({ where: { id }, include: { cliente: { include: { usuarios: { where: { papel: "CLIENTE", ativo: true } } } } } });
  if (!m.interCodigo) return { mensalidade: m, pagaAgora: false };
  const c = await consultarCobranca(m.interCodigo);
  const sit = c.cobranca.situacao;
  const efeito = interpretarSituacao(sit);
  const dados = {
    interSituacao: sit,
    interAtualizadoEm: new Date(),
    linhaDigitavel: c.boleto?.linhaDigitavel ?? m.linhaDigitavel,
    pixCopiaECola: c.pix?.pixCopiaECola ?? m.pixCopiaECola,
    interErro: efeito === "FALHA" ? "O banco não conseguiu emitir a cobrança. Confira o cadastro do cliente e emita de novo." : null,
  };
  const pagaAgora = efeito === "PAGO" && m.status !== "PAGO";
  const atualizada = await prisma.mensalidade.update({
    where: { id },
    data: pagaAgora ? { ...dados, status: "PAGO", pagoEm: c.cobranca.dataSituacao ? lerData(c.cobranca.dataSituacao.slice(0, 10)) : hojeBrasil(), formaPagamento: formaRecebimento(c.cobranca.origemRecebimento) } : dados,
  });
  if (pagaAgora) {
    const valor = c.cobranca.valorTotalRecebido ? Number(c.cobranca.valorTotalRecebido) : num(m.valor);
    await registrarAtividade({ clienteId: m.clienteId, acao: "MENSALIDADE_PAGA", descricao: `Mensalidade ${formatarCompetencia(m.ano, m.mes)} paga — baixa automática pelo Inter (${formaRecebimento(c.cobranca.origemRecebimento)}, ${formatarMoeda(valor)})` });
    const u = m.cliente.usuarios[0];
    if (u) await enviarEmail(u.email, "Pagamento recebido — obrigado!", `<p>Olá, ${u.nome.split(" ")[0]}!</p><p>Recebemos o pagamento da mensalidade de ${formatarCompetencia(m.ano, m.mes)} (${formatarMoeda(valor)}) em ${formatarData(atualizada.pagoEm ?? hojeBrasil())}.</p>`);
  }
  return { mensalidade: atualizada, pagaAgora };
}

/** Cancela no banco a cobrança ainda pagável (ex.: cliente pagou em dinheiro), para evitar pagamento em dobro. */
export async function cancelarCobrancaMensalidade(id: string, motivo: string) {
  const m = await prisma.mensalidade.findUniqueOrThrow({ where: { id } });
  if (!m.interCodigo || !cobrancaAtiva(m.interSituacao)) return false;
  await cancelarCobranca(m.interCodigo, motivo);
  await prisma.mensalidade.update({ where: { id }, data: { interSituacao: "CANCELADO", interAtualizadoEm: new Date() } });
  return true;
}

/**
 * Rotina diária: emite as cobranças das mensalidades em aberto que ainda não têm cobrança
 * e confere no banco as cobranças pendentes (garante a baixa mesmo se algum aviso do webhook se perder).
 */
export async function rotinaCobrancaInter(hoje = hojeBrasil()) {
  const relatorio = { emitidas: 0, conferidas: 0, pagas: 0, erros: 0 };
  if (!(await cobrancaInterAtiva())) return relatorio;
  const semCobranca = await prisma.mensalidade.findMany({ where: { status: "ABERTO", interCodigo: null, interErro: null, vencimento: { gte: hoje } }, take: 50 });
  for (const m of semCobranca) {
    try {
      await emitirCobrancaMensalidade(m.id);
      relatorio.emitidas++;
    } catch {
      relatorio.erros++;
    }
  }
  const pendentes = await prisma.mensalidade.findMany({ where: { status: "ABERTO", interCodigo: { not: null }, interSituacao: { in: ["EM_PROCESSAMENTO", "A_RECEBER", "ATRASADO"] } }, orderBy: { vencimento: "asc" }, take: 100 });
  for (const m of pendentes) {
    try {
      const r = await sincronizarMensalidade(m.id);
      relatorio.conferidas++;
      if (r.pagaAgora) relatorio.pagas++;
    } catch {
      relatorio.erros++;
    }
  }
  return relatorio;
}
