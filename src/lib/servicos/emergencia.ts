import "server-only";
import { registrarAtividade } from "@/lib/atividade";
import { prisma } from "@/lib/db";
import { notificarVarios, tocarDeNovo } from "@/lib/notificacoes";
import type { OpcaoPendencia, PendenciaComAcoes } from "@/lib/servicos/lembretes";

/**
 * SOS da empregada: avisa na hora todos os patrões do cliente e o consultor (notificação urgente, fixa na tela),
 * repete o alerta enquanto ninguém responder e guarda os trechos de áudio gravados pelo celular dela.
 */

const mapa = (lat?: number | null, lng?: number | null) => (lat != null && lng != null ? ` Localização: https://www.google.com/maps?q=${lat},${lng}` : "");

async function destinatarios(clienteId: string) {
  const [patroes, consultores] = await Promise.all([
    prisma.usuario.findMany({ where: { clienteId, papel: "CLIENTE", ativo: true }, select: { id: true } }),
    prisma.usuario.findMany({ where: { papel: "CONSULTOR", ativo: true }, select: { id: true } }),
  ]);
  return { patroes: patroes.map((u) => u.id), consultores: consultores.map((u) => u.id) };
}

export async function iniciarEmergencia(opcoes: { empregadoId: string; usuarioId: string; latitude?: number | null; longitude?: number | null; precisao?: number | null }) {
  const e = await prisma.empregado.findUniqueOrThrow({ where: { id: opcoes.empregadoId }, include: { cliente: { select: { nome: true } } } });
  // Evita abrir duas emergências se ela segurar o botão de novo: reaproveita a que está aberta
  const aberta = await prisma.emergencia.findFirst({ where: { empregadoId: e.id, status: { not: "ENCERRADA" }, iniciadaEm: { gte: new Date(Date.now() - 60 * 60_000) } } });
  const em = aberta ?? (await prisma.emergencia.create({ data: { empregadoId: e.id, clienteId: e.clienteId, latitude: opcoes.latitude, longitude: opcoes.longitude, precisao: opcoes.precisao } }));
  if (!aberta) {
    const nome = e.nome.split(" ")[0];
    const { patroes, consultores } = await destinatarios(e.clienteId);
    await notificarVarios(patroes, { chave: `sos:${em.id}:0`, titulo: `🚨 EMERGÊNCIA na casa — ${nome} pediu ajuda`, texto: `${nome} acionou o SOS agora e precisa de você na casa imediatamente. O áudio está sendo gravado.${mapa(em.latitude, em.longitude)}`, link: `/emergencia/${em.id}`, acao: "Estou indo", urgente: true });
    await notificarVarios(consultores, { chave: `sos:${em.id}:0`, titulo: `🚨 SOS — ${nome} (${e.cliente.nome})`, texto: "A empregada acionou o botão de emergência. Os patrões foram avisados.", link: `/emergencia/${em.id}`, acao: "Ver", urgente: true });
    await registrarAtividade({ usuarioId: opcoes.usuarioId, clienteId: e.clienteId, acao: "SOS", descricao: `${e.nome} acionou o SOS (emergência na casa)` });
  }
  return em;
}

export async function atenderEmergencia(id: string, usuario: { id: string; nome: string }) {
  const em = await prisma.emergencia.update({ where: { id }, data: { status: "ATENDIDA", atendidaPorId: usuario.id, atendidaPor: usuario.nome, atendidaEm: new Date() } });
  const emp = await prisma.usuario.findFirst({ where: { empregadoId: em.empregadoId, ativo: true }, select: { id: true } });
  if (emp) await notificarVarios([emp.id], { chave: `sos-atendida:${em.id}:${usuario.id}`, titulo: `${usuario.nome.split(" ")[0]} está indo`, texto: "Seu pedido de ajuda foi recebido. Se for grave, ligue também para o 192 (SAMU), 193 (Bombeiros) ou 190 (Polícia).", link: "/ponto", urgente: true });
  const { patroes } = await destinatarios(em.clienteId);
  await notificarVarios(patroes.filter((p) => p !== usuario.id), { chave: `sos-atendida:${em.id}:${usuario.id}`, titulo: `${usuario.nome.split(" ")[0]} respondeu ao SOS e está indo`, texto: "A emergência continua aberta até ser encerrada.", link: `/emergencia/${em.id}` });
  await registrarAtividade({ usuarioId: usuario.id, clienteId: em.clienteId, acao: "SOS", descricao: `${usuario.nome} respondeu ao SOS: está indo` });
  return em;
}

export async function encerrarEmergencia(id: string, usuarioId: string) {
  const em = await prisma.emergencia.update({ where: { id }, data: { status: "ENCERRADA", encerradaEm: new Date() } });
  await registrarAtividade({ usuarioId, clienteId: em.clienteId, acao: "SOS", descricao: "Emergência encerrada" });
  return em;
}

/**
 * Enquanto o celular dela grava (trechos a cada 15 s), o SOS sem resposta faz os celulares dos patrões e do
 * consultor tocarem de novo a cada 30 s — o som não para até alguém tocar em "Estou indo".
 */
export async function insistirNoSos(id: string, ordemTrecho: number) {
  if (ordemTrecho % 2) return;
  const em = await prisma.emergencia.findUnique({ where: { id }, include: { empregado: { select: { nome: true } } } });
  if (!em || em.status !== "ATIVA") return;
  const nome = em.empregado.nome.split(" ")[0];
  const { patroes, consultores } = await destinatarios(em.clienteId);
  const segundos = Math.round((Date.now() - em.iniciadaEm.getTime()) / 1000);
  await tocarDeNovo([...patroes, ...consultores], { chave: `sos:${em.id}:0`, titulo: `🚨 EMERGÊNCIA — ${nome} pediu ajuda (sem resposta há ${Math.floor(segundos / 60)} min ${segundos % 60} s)`, texto: `Toque em "Estou indo" para parar o alarme.${mapa(em.latitude, em.longitude)}`, link: `/emergencia/${em.id}`, acao: "Estou indo", urgente: true });
}

/** Rotina frequente: SOS sem resposta continua avisando os patrões (a cada execução, ~10 min). */
export async function repetirEmergenciasSemResposta(agora = new Date()) {
  let n = 0;
  for (const em of await prisma.emergencia.findMany({ where: { status: "ATIVA", iniciadaEm: { gte: new Date(agora.getTime() - 6 * 3600_000) } }, include: { empregado: { select: { nome: true } } } })) {
    const minutos = Math.floor((agora.getTime() - em.iniciadaEm.getTime()) / 60_000);
    if (minutos < 2) continue;
    const { patroes, consultores } = await destinatarios(em.clienteId);
    n += await notificarVarios([...patroes, ...consultores], { chave: `sos:${em.id}:${Math.floor(minutos / 10)}`, titulo: `🚨 SOS SEM RESPOSTA há ${minutos} min — ${em.empregado.nome.split(" ")[0]}`, texto: `Ninguém respondeu ainda. Toque em "Estou indo" ou ligue para ela.${mapa(em.latitude, em.longitude)}`, link: `/emergencia/${em.id}`, acao: "Estou indo", urgente: true });
  }
  return n;
}

/** SOS abertos como pendência de tela cheia (patrão: do seu cliente; consultor: todos), com os botões que resolvem. */
export async function alertasDeEmergencia(filtro: { clienteId?: string }): Promise<PendenciaComAcoes[]> {
  const abertas = await prisma.emergencia.findMany({
    where: { status: { not: "ENCERRADA" }, iniciadaEm: { gte: new Date(Date.now() - 12 * 3600_000) }, ...(filtro.clienteId ? { clienteId: filtro.clienteId } : {}) },
    include: { empregado: { select: { nome: true, telefone: true, cliente: { select: { nome: true } } } } },
    orderBy: { iniciadaEm: "desc" },
  });
  return abertas.map((em) => {
    const nome = em.empregado.nome.split(" ")[0];
    const hora = em.iniciadaEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    const tel = em.empregado.telefone?.replace(/\D/g, "");
    const opcoes: OpcaoPendencia[] = [];
    if (em.status === "ATIVA") opcoes.push({ rotulo: "🏃 Estou indo", tipo: "SOS_ATENDER", dados: { emergenciaId: em.id }, estilo: "perigo" });
    if (tel) opcoes.push({ rotulo: `📞 Ligar para ${nome}`, tipo: "LINK", link: `tel:${tel}`, estilo: "secundario" });
    opcoes.push({ rotulo: "Ver local e ouvir a gravação", tipo: "LINK", link: `/emergencia/${em.id}`, estilo: "secundario" });
    opcoes.push({ rotulo: "Encerrar a emergência (já resolvido)", tipo: "SOS_ENCERRAR", dados: { emergenciaId: em.id }, estilo: "secundario", confirmar: "Encerrar a emergência? Faça isso só quando a situação estiver resolvida." });
    return {
      chave: `sos:${em.id}`,
      para: "EMPREGADOR",
      // Alarme (tela vermelha e sirene) enquanto ninguém respondeu; depois do "Estou indo" vira pendência comum
      urgente: em.status === "ATIVA",
      titulo: `🚨 EMERGÊNCIA — ${nome} pediu ajuda às ${hora}`,
      texto: em.status === "ATENDIDA" ? `${em.atendidaPor} respondeu que está indo. Encerre quando estiver resolvido.` : `${nome} acionou o SOS${filtro.clienteId ? "" : ` (${em.empregado.cliente.nome})`} e precisa de alguém na casa imediatamente. Ninguém respondeu ainda.`,
      link: `/emergencia/${em.id}`,
      acao: "Abrir a emergência",
      opcoes,
    };
  });
}
