import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sincronizarMensalidade } from "@/lib/servicos/cobranca-inter";

/**
 * Aviso de pagamento do Banco Inter (webhook da API de Cobrança).
 * O endereço cadastrado no banco leva um token secreto (?token=INTER_WEBHOOK_TOKEN). O conteúdo do aviso
 * só indica QUAL cobrança mudou: a situação é sempre confirmada consultando o próprio banco.
 * Se o banco não responder, devolvemos 503 para o Inter reenviar o aviso.
 */
export async function POST(req: NextRequest) {
  const esperado = process.env.INTER_WEBHOOK_TOKEN ?? "";
  const recebido = req.nextUrl.searchParams.get("token") ?? "";
  if (esperado.length < 16 || recebido.length !== esperado.length || !timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))) {
    return new NextResponse("Não autorizado", { status: 401 });
  }
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new NextResponse("Corpo inválido", { status: 400 });
  }
  const itens = (Array.isArray(corpo) ? corpo : [corpo]) as { codigoSolicitacao?: unknown }[];
  const codigos = [...new Set(itens.map((i) => (typeof i?.codigoSolicitacao === "string" ? i.codigoSolicitacao : "")).filter(Boolean))].slice(0, 100);
  const mensalidades = await prisma.mensalidade.findMany({ where: { interCodigo: { in: codigos } }, select: { id: true } });
  let falhas = 0;
  for (const m of mensalidades) {
    try {
      await sincronizarMensalidade(m.id);
    } catch (e) {
      console.error("Webhook Inter: falha ao conferir cobrança", e);
      falhas++;
    }
  }
  if (falhas) return new NextResponse("Tente novamente", { status: 503 });
  return NextResponse.json({ ok: true, conferidas: mensalidades.length });
}
