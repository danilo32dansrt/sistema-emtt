import "server-only";
import { registrarAtividade } from "../atividade";
import { addDias, competenciaAnterior, formatarCompetencia, formatarData, formatarMoeda, hojeBrasil, ultimoDiaMes, vencimentoDae } from "../calculos";
import { num } from "../conversao";
import { prisma } from "../db";
import { cancelarPagamentoAgendado, configInter, consultarPagamento, pagarComCodigoBarras } from "../inter/api";
import { codigoBarrasValido, composicaoCobrancaPlus, dataPagamentoDae, statusPorSituacaoInter, vencimentoCobrancaPlus, type StatusPagamentoDae } from "../inter/plus";
import { cobrancaAtiva } from "../inter/regras";
import { avisarPatroes, notificarVarios } from "../notificacoes";
import { configuracao } from "../tabelas-db";
import { cancelarCobrancaMensalidade, cobrancaInterAtiva, emitirCobrancaMensalidade } from "./cobranca-inter";

/**
 * Plano Plus: uma cobrança por mês (mensalidade + DAE da competência anterior). Quando o cliente paga,
 * a consultoria paga o DAE por conta e ordem dele (pelo Inter, se ligado; senão, à mão e marca como pago).
 * Se o cliente não pagar, a consultoria NÃO paga o DAE com dinheiro próprio.
 */

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function avisarConsultores(chave: string, titulo: string, texto: string, link = "/consultor/financeiro") {
  const us = await prisma.usuario.findMany({ where: { papel: "CONSULTOR", ativo: true }, select: { id: true } });
  await notificarVarios(us.map((u) => u.id), { chave, titulo, texto, link, acao: "Abrir" }).catch(() => 0);
}

/** DAEs da competência anterior ao mês da mensalidade (o DAE de março vence em abril, junto com a mensalidade de abril). */
async function daesDaMensalidade(mensalidadeId: string) {
  const m = await prisma.mensalidade.findUniqueOrThrow({ where: { id: mensalidadeId }, include: { cliente: true } });
  const comp = competenciaAnterior(m.ano, m.mes);
  const empregados = await prisma.empregado.findMany({
    where: { clienteId: m.clienteId, admissao: { lte: ultimoDiaMes(comp.ano, comp.mes) }, OR: [{ desligamento: null }, { desligamento: { gte: new Date(Date.UTC(comp.ano, comp.mes - 1, 1)) } }] },
    include: { competencias: { where: { ano: comp.ano, mes: comp.mes } } },
  });
  return { m, comp, empregados };
}

/** A cobrança única do Plus pode sair? (todos os DAEs do mês emitidos com valor e código de barras) */
export async function cobrancaPlusPronta(mensalidadeId: string): Promise<boolean> {
  return (await prepararCobrancaPlus(mensalidadeId)).pronta;
}

/**
 * Junta os DAEs prontos na mensalidade do Plus: registra cada DAE a pagar, soma o valor e acerta o vencimento.
 * Se a cobrança já tinha sido emitida com outro valor (DAE corrigido) e ainda não foi paga, cancela e emite de novo.
 */
export async function prepararCobrancaPlus(mensalidadeId: string) {
  const { m, comp, empregados } = await daesDaMensalidade(mensalidadeId);
  if (m.cliente.plano !== "PLUS" || m.status !== "ABERTO") return { pronta: true, faltando: [] as string[] };
  const daes = empregados.map((e) => {
    const c = e.competencias[0];
    const codigo = codigoBarrasValido(c?.daeCodigo);
    return { empregado: e.nome.split(" ")[0], emitido: Boolean(c?.daeEmitido && codigo && num(c.daeValor) > 0), valor: num(c?.daeValor), competenciaId: c?.id, codigo };
  });
  const comp2 = composicaoCobrancaPlus(num(m.valor), daes);
  if (!comp2.pronta) return { pronta: false, faltando: comp2.faltando };

  const cfg = await configuracao();
  const venc = vencimentoDae(comp.ano, comp.mes);
  for (const d of daes) {
    const existente = await prisma.pagamentoDae.findUnique({ where: { competenciaId: d.competenciaId! } });
    if (existente && ["AGENDADO", "AGUARDANDO_APROVACAO", "PAGO"].includes(existente.status)) continue;
    const dados = { clienteId: m.clienteId, mensalidadeId: m.id, valor: d.valor, codigoBarras: d.codigo!, vencimento: venc };
    await prisma.pagamentoDae.upsert({ where: { competenciaId: d.competenciaId! }, create: { competenciaId: d.competenciaId!, ...dados }, update: { ...dados, erro: null, status: existente?.status === "PRONTO" ? "PRONTO" : "AGUARDANDO_RECURSO" } });
  }
  const mudouValor = Math.round(num(m.valorDae) * 100) !== Math.round(comp2.valorDae * 100);
  await prisma.mensalidade.update({ where: { id: m.id }, data: { valorDae: comp2.valorDae, vencimento: vencimentoCobrancaPlus(hojeBrasil(), venc, cfg.diaVencimentoPlus) } });
  if (mudouValor && m.interCodigo && cobrancaAtiva(m.interSituacao)) {
    await cancelarCobrancaMensalidade(m.id, "Valor do DAE atualizado");
    await prisma.mensalidade.update({ where: { id: m.id }, data: { interCodigo: null, interSituacao: null, linhaDigitavel: null, pixCopiaECola: null, interErro: null } });
  }
  return { pronta: true, faltando: [] as string[], total: comp2.total };
}

/** Depois que o consultor emite um DAE: se o cliente é Plus, junta na cobrança do mês e emite quando tudo estiver pronto. */
export async function aoEmitirDae(empregadoId: string, ano: number, mes: number) {
  const e = await prisma.empregado.findUniqueOrThrow({ where: { id: empregadoId }, include: { cliente: true } });
  if (e.cliente.plano !== "PLUS") return null;
  // A mensalidade do mês seguinte à competência leva o DAE
  const alvo = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
  const m = await prisma.mensalidade.findUnique({ where: { clienteId_ano_mes: { clienteId: e.clienteId, ano: alvo.ano, mes: alvo.mes } } });
  if (!m) return { aviso: `Gere a mensalidade de ${formatarCompetencia(alvo.ano, alvo.mes)} para juntar este DAE na cobrança do cliente.` };
  const r = await prepararCobrancaPlus(m.id);
  if (!r.pronta) return { aviso: `Cobrança Plus aguardando os DAEs de: ${r.faltando.join(", ")}.` };
  if (await cobrancaInterAtiva()) {
    await emitirCobrancaMensalidade(m.id).catch(() => null);
  }
  const atual = await prisma.mensalidade.findUniqueOrThrow({ where: { id: m.id } });
  await avisarPatroes(e.clienteId, { chave: `plus-cobranca:${m.id}:${Math.round((num(atual.valor) + num(atual.valorDae)) * 100)}`, titulo: "Sua cobrança do mês está pronta", texto: `Mensalidade + DAE: ${formatarMoeda(num(atual.valor) + num(atual.valorDae))}, vencimento ${formatarData(atual.vencimento)}. Depois de pagar, a consultoria paga o DAE por você.`, link: "/cliente/mensalidade", acao: "Pagar agora" });
  return { aviso: `Cobrança única de ${formatarMoeda(num(atual.valor) + num(atual.valorDae))} pronta para o cliente.` };
}

/** O cliente pagou a cobrança do Plus: o dinheiro do DAE está na conta — paga (ou agenda) os DAEs. */
export async function liberarPagamentosDae(mensalidadeId: string) {
  const pendentes = await prisma.pagamentoDae.findMany({ where: { mensalidadeId, status: "AGUARDANDO_RECURSO" } });
  for (const p of pendentes) await prisma.pagamentoDae.update({ where: { id: p.id }, data: { status: "PRONTO" } });
  for (const p of pendentes) await pagarDae(p.id).catch((e) => console.error("Falha ao pagar o DAE", e));
}

/** Paga o DAE pelo Inter (se ligado) ou avisa o consultor para pagar à mão. */
export async function pagarDae(id: string) {
  const p = await prisma.pagamentoDae.findUniqueOrThrow({ where: { id }, include: { competencia: { include: { empregado: { select: { nome: true } } } }, cliente: { select: { nome: true } } } });
  if (p.status !== "PRONTO" && p.status !== "FALHA") return p;
  const quem = `${p.competencia.empregado.nome.split(" ")[0]} (${p.cliente.nome})`;
  const comp = formatarCompetencia(p.competencia.ano, p.competencia.mes);
  const cfg = await configuracao();
  if (!cfg.pagamentoDaeInter || !configInter().configurado) {
    await avisarConsultores(`plus-pagar:${p.id}`, "Pague o DAE do cliente Plus", `Dinheiro recebido: DAE ${comp} de ${quem}, ${formatarMoeda(num(p.valor))}, vence ${formatarData(p.vencimento)}. Pague e marque como pago.`);
    return p;
  }
  const data = dataPagamentoDae(hojeBrasil(), p.vencimento);
  if (!data.ok) {
    await prisma.pagamentoDae.update({ where: { id }, data: { status: "FALHA", erro: data.erro } });
    await avisarConsultores(`plus-falha:${p.id}:${iso(hojeBrasil())}`, "DAE do cliente Plus não pôde ser pago", `${quem}, ${comp}: ${data.erro}`);
    return p;
  }
  try {
    const r = await pagarComCodigoBarras({ codigoBarras: p.codigoBarras, valor: num(p.valor), vencimento: iso(p.vencimento), dataPagamento: data.data });
    const status = statusPorSituacaoInter(r.statusPagamento);
    await prisma.pagamentoDae.update({ where: { id }, data: { interTransacao: r.codigoTransacao, interStatus: r.statusPagamento, status, agendadoPara: new Date(`${data.data}T00:00:00Z`), erro: null } });
    await registrarAtividade({ clienteId: p.clienteId, acao: "DAE_PLUS", descricao: `DAE ${comp} de ${quem} enviado ao Inter (${r.statusPagamento})` });
    await efeitosDoStatus(id, status);
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Falha no Inter.";
    await prisma.pagamentoDae.update({ where: { id }, data: { status: "FALHA", erro } });
    await avisarConsultores(`plus-falha:${p.id}:${iso(hojeBrasil())}`, "Falha ao pagar o DAE pelo Inter", `${quem}, ${comp}: ${erro}`);
  }
  return prisma.pagamentoDae.findUniqueOrThrow({ where: { id } });
}

async function efeitosDoStatus(id: string, status: StatusPagamentoDae) {
  const p = await prisma.pagamentoDae.findUniqueOrThrow({ where: { id }, include: { competencia: { include: { empregado: { select: { nome: true } } } } } });
  const comp = formatarCompetencia(p.competencia.ano, p.competencia.mes);
  if (status === "AGUARDANDO_APROVACAO") {
    await avisarConsultores(`plus-aprovar:${p.id}:${iso(hojeBrasil())}`, "Aprove o pagamento do DAE no app do Inter", `DAE ${comp} de ${p.competencia.empregado.nome.split(" ")[0]}, ${formatarMoeda(num(p.valor))}. Sem a aprovação o DAE não é pago.`);
  }
  if (status === "PAGO") await marcarDaePago(id);
}

/** DAE pago (confirmado pelo Inter ou marcado pelo consultor): fecha a rotina e avisa o cliente. */
export async function marcarDaePago(id: string, usuarioId?: string) {
  const p = await prisma.pagamentoDae.update({ where: { id }, data: { status: "PAGO", pagoEm: new Date() }, include: { competencia: { include: { empregado: { select: { nome: true } } } } } });
  await prisma.competencia.update({ where: { id: p.competenciaId }, data: { pagamentoConfirmado: true } });
  const comp = formatarCompetencia(p.competencia.ano, p.competencia.mes);
  await registrarAtividade({ usuarioId, clienteId: p.clienteId, acao: "DAE_PLUS", descricao: `DAE ${comp} de ${p.competencia.empregado.nome} pago pela consultoria (${formatarMoeda(num(p.valor))})` });
  await avisarPatroes(p.clienteId, { chave: `plus-pago:${p.id}`, titulo: "DAE pago pela consultoria", texto: `O DAE ${comp} de ${p.competencia.empregado.nome.split(" ")[0]} (${formatarMoeda(num(p.valor))}) foi pago. O comprovante fica no portal.`, link: "/cliente/dae" });
}

/** Rotina diária: confere no Inter os pagamentos agendados/aguardando aprovação e tenta de novo os que estão prontos. */
export async function rotinaPlus(hoje = hojeBrasil()) {
  const rel = { conferidos: 0, pagos: 0, tentativas: 0, semRecurso: 0 };
  const cfg = await configuracao();
  if (cfg.pagamentoDaeInter && configInter().configurado) {
    for (const p of await prisma.pagamentoDae.findMany({ where: { status: { in: ["AGENDADO", "AGUARDANDO_APROVACAO"] }, interTransacao: { not: null } } })) {
      try {
        const info = await consultarPagamento(p.interTransacao!, iso(addDias(p.criadoEm, -1)), iso(addDias(hoje, 1)));
        rel.conferidos++;
        if (!info) continue;
        const status = statusPorSituacaoInter(info.statusPagamento);
        if (status !== p.status) {
          await prisma.pagamentoDae.update({ where: { id: p.id }, data: { status, interStatus: info.statusPagamento } });
          await efeitosDoStatus(p.id, status);
          if (status === "PAGO") rel.pagos++;
        } else if (status === "AGUARDANDO_APROVACAO") await efeitosDoStatus(p.id, status);
      } catch (e) {
        console.error("Falha ao conferir pagamento do DAE", e);
      }
    }
    for (const p of await prisma.pagamentoDae.findMany({ where: { status: "PRONTO" } })) {
      rel.tentativas++;
      await pagarDae(p.id).catch(() => null);
    }
  }
  // Cliente Plus que ainda não pagou e o DAE vence em até 2 dias: avisa o consultor (o DAE não é pago com dinheiro próprio)
  for (const p of await prisma.pagamentoDae.findMany({ where: { status: "AGUARDANDO_RECURSO", vencimento: { lte: addDias(hoje, 2) } }, include: { cliente: { select: { nome: true } }, competencia: { include: { empregado: { select: { nome: true } } } } } })) {
    rel.semRecurso++;
    await avisarConsultores(`plus-sem-recurso:${p.id}:${iso(hoje)}`, "Cliente Plus ainda não pagou", `${p.cliente.nome}: o DAE de ${p.competencia.empregado.nome.split(" ")[0]} (${formatarMoeda(num(p.valor))}) vence ${formatarData(p.vencimento)} e a cobrança do mês não foi paga. Fale com o cliente.`);
  }
  return rel;
}

/** Corrige o DAE (nova guia): cancela o agendamento no Inter, se houver, e volta para "pronto". */
export async function reabrirPagamentoDae(id: string) {
  const p = await prisma.pagamentoDae.findUniqueOrThrow({ where: { id } });
  if (p.interTransacao && (p.status === "AGENDADO" || p.status === "AGUARDANDO_APROVACAO")) await cancelarPagamentoAgendado(p.interTransacao);
  const recebido = p.mensalidadeId ? (await prisma.mensalidade.findUnique({ where: { id: p.mensalidadeId } }))?.status === "PAGO" : false;
  await prisma.pagamentoDae.update({ where: { id }, data: { status: recebido ? "PRONTO" : "AGUARDANDO_RECURSO", interTransacao: null, interStatus: null, agendadoPara: null, erro: null } });
}
