import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { pdfCobranca } from "@/lib/inter/api";
import { cobrancaAtiva } from "@/lib/inter/regras";

/** PDF do boleto (com QR Code Pix) gerado pelo Inter. O cliente só baixa as próprias mensalidades. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioAtual();
  if (!u) return new NextResponse("Faça login.", { status: 401 });
  const m = await prisma.mensalidade.findUnique({ where: { id } });
  if (!m || (u.papel !== "CONSULTOR" && !(u.papel === "CLIENTE" && u.clienteId === m.clienteId))) return new NextResponse("Cobrança não encontrada.", { status: 404 });
  if (!m.interCodigo || !cobrancaAtiva(m.interSituacao)) return new NextResponse("Esta mensalidade não tem boleto em aberto.", { status: 404 });
  try {
    const pdf = await pdfCobranca(m.interCodigo);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="mensalidade-${m.ano}-${String(m.mes).padStart(2, "0")}.pdf"`, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "O banco não respondeu. Tente de novo em instantes.", { status: 502 });
  }
}
