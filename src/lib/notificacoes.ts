import "server-only";
import webpush from "web-push";
import { prisma } from "./db";

/**
 * Avisos para patrão e empregada: ficam na central de avisos do app e, se o celular aceitou,
 * chegam como notificação (Web Push). Chaves VAPID só no .env (gere com: npx web-push generate-vapid-keys).
 */

export function chavePublicaPush(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

let configurado = false;
function pushDisponivel(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!pub || !priv) return false;
  if (!configurado) {
    webpush.setVapidDetails(process.env.VAPID_ASSUNTO?.trim() || "mailto:contato@example.com", pub, priv);
    configurado = true;
  }
  return true;
}

export interface Aviso {
  chave: string;
  titulo: string;
  texto: string;
  link?: string;
}

/** Cria o aviso (uma única vez por chave) e manda para os celulares do usuário. Devolve true se era novo. */
export async function notificar(usuarioId: string, a: Aviso): Promise<boolean> {
  try {
    await prisma.notificacao.create({ data: { usuarioId, chave: a.chave, titulo: a.titulo, texto: a.texto, link: a.link } });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) return false;
    throw e;
  }
  if (!pushDisponivel()) return true;
  const inscricoes = await prisma.inscricaoPush.findMany({ where: { usuarioId } });
  const corpo = JSON.stringify({ titulo: a.titulo, texto: a.texto, link: a.link ?? "/", tag: a.chave });
  await Promise.all(
    inscricoes.map(async (i) => {
      try {
        await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, corpo, { TTL: 60 * 60 * 6, urgency: "high" });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // Celular desinstalou o app ou cancelou a permissão
        if (status === 404 || status === 410) await prisma.inscricaoPush.delete({ where: { id: i.id } }).catch(() => undefined);
        else console.error("Falha ao enviar notificação", status ?? e);
      }
    }),
  );
  return true;
}

/** Avisa todos os usuários ativos de um papel/cliente (ex.: os patrões de um cliente). */
export async function notificarVarios(usuarioIds: string[], a: Aviso): Promise<number> {
  let n = 0;
  for (const id of usuarioIds) if (await notificar(id, a)) n++;
  return n;
}

/** Avisa os patrões (usuários do cliente). Erros de envio não atrapalham a ação principal. */
export async function avisarPatroes(clienteId: string, a: Aviso): Promise<void> {
  try {
    const us = await prisma.usuario.findMany({ where: { clienteId, papel: "CLIENTE", ativo: true }, select: { id: true } });
    await notificarVarios(us.map((u) => u.id), a);
  } catch (e) {
    console.error("Falha ao avisar o patrão", e);
  }
}

/** Avisa a empregada (se ela tiver acesso ao app). */
export async function avisarEmpregada(empregadoId: string, a: Aviso): Promise<void> {
  try {
    const u = await prisma.usuario.findFirst({ where: { empregadoId, ativo: true }, select: { id: true } });
    if (u) await notificar(u.id, a);
  } catch (e) {
    console.error("Falha ao avisar a empregada", e);
  }
}
