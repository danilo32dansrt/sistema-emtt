import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { dataUrlParaBytes, salvarBytes } from "@/lib/arquivos";
import { usuarioAtual } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { registrarMarcacao, ROTULO_MARCACAO } from "@/lib/ponto/registro";

const esquema = z.object({
  tipo: z.enum(["ENTRADA", "SAIDA_INTERVALO", "RETORNO_INTERVALO", "SAIDA"]),
  dataHora: z.string().datetime(),
  idLocal: z.string().uuid(),
  origem: z.enum(["ONLINE", "OFFLINE"]),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  precisao: z.number().min(0).nullable().optional(),
  selfie: z.string().max(7_000_000).nullable().optional(),
});

/** Registra uma marcação de ponto do empregado logado (também usado na sincronização offline). */
export async function POST(req: NextRequest) {
  const origem = req.headers.get("origin");
  if (origem && new URL(origem).host !== req.headers.get("host")) return NextResponse.json({ erro: "Origem não permitida." }, { status: 403 });
  const u = await usuarioAtual();
  if (!u || u.papel !== "EMPREGADO" || !u.empregadoId) return NextResponse.json({ erro: "Faça login novamente." }, { status: 401 });
  if (!u.consentimentoLgpdEm) return NextResponse.json({ erro: "Leia e aceite o aviso de privacidade antes de marcar o ponto." }, { status: 403 });

  let corpo;
  try {
    corpo = esquema.parse(await req.json());
  } catch {
    return NextResponse.json({ erro: "Dados da marcação inválidos." }, { status: 400 });
  }
  const emp = await prisma.empregado.findUnique({ where: { id: u.empregadoId } });
  if (!emp || emp.situacao === "DESLIGADO" || !emp.pontoAtivo) return NextResponse.json({ erro: "Ponto eletrônico não está ativo para você." }, { status: 403 });
  if (emp.exigirSelfie && !corpo.selfie) return NextResponse.json({ erro: "A selfie é obrigatória para marcar o ponto." }, { status: 400 });

  try {
    let selfieArquivoId: string | null = null;
    const existente = await prisma.marcacaoPonto.findUnique({ where: { idLocal: corpo.idLocal } });
    if (!existente && corpo.selfie) {
      const { mime, dados } = dataUrlParaBytes(corpo.selfie);
      selfieArquivoId = (await salvarBytes(dados, { nome: `selfie-${corpo.idLocal}.jpg`, mime, clienteId: emp.clienteId, criadoPorId: u.id })).id;
    }
    const { marcacao, duplicada } = await registrarMarcacao({
      empregadoId: emp.id,
      cpf: emp.cpf,
      tipo: corpo.tipo,
      dataHora: new Date(corpo.dataHora),
      idLocal: corpo.idLocal,
      origem: corpo.origem,
      latitude: emp.exigirLocalizacao ? corpo.latitude : null,
      longitude: emp.exigirLocalizacao ? corpo.longitude : null,
      precisaoMetros: emp.exigirLocalizacao ? corpo.precisao : null,
      selfieArquivoId,
      dispositivo: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    return NextResponse.json({
      ok: true,
      duplicada,
      comprovante: {
        nsr: marcacao.nsr,
        tipo: ROTULO_MARCACAO[marcacao.tipo],
        dataHora: marcacao.dataHora.toISOString(),
        recebidoEm: marcacao.recebidoEm.toISOString(),
        hash: marcacao.hash,
        empregado: emp.nome,
      },
    });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Erro ao registrar." }, { status: 422 });
  }
}
