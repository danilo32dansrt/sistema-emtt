import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { dataUrlParaBytes, salvarBytes } from "@/lib/arquivos";
import { usuarioAtual } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { avisarPatroes } from "@/lib/notificacoes";
import { avaliarLocal } from "@/lib/ponto/geo";
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
  /** A empregada confirmou que está na casa mesmo com o GPS fora do raio (ou sem GPS). */
  registrarForaDoLocal: z.boolean().optional(),
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

  // Local da casa (GPS): fora do raio, a marcação feita na hora só entra se ela confirmar que está na casa.
  // Marcações guardadas sem internet (OFFLINE) nunca são barradas: entram e ficam sinalizadas.
  const existente = await prisma.marcacaoPonto.findUnique({ where: { idLocal: corpo.idLocal } });
  const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: emp.clienteId }, select: { localLatitude: true, localLongitude: true, localRaioMetros: true } });
  const casa = emp.exigirLocalizacao && cliente.localLatitude !== null && cliente.localLongitude !== null ? { latitude: cliente.localLatitude, longitude: cliente.localLongitude, raio: cliente.localRaioMetros } : null;
  const pos = corpo.latitude != null && corpo.longitude != null ? { latitude: corpo.latitude, longitude: corpo.longitude, precisao: corpo.precisao } : null;
  const local = casa ? avaliarLocal(pos, casa) : null;
  const fora = local?.situacao === "FORA" || local?.situacao === "SEM_GPS";
  if (fora && !existente && corpo.origem === "ONLINE" && !corpo.registrarForaDoLocal) {
    return NextResponse.json({
      erro: local!.situacao === "SEM_GPS" ? "Não foi possível pegar a sua localização. Ative a localização (GPS) do celular e tente de novo." : `Você está a ${local!.distancia} m da casa (o limite é ${casa!.raio} m). Chegue mais perto e tente de novo.`,
      foraDoLocal: true,
      distancia: local!.distancia,
    }, { status: 409 });
  }

  try {
    let selfieArquivoId: string | null = null;
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
      distanciaMetros: local?.distancia ?? null,
      foraDoLocal: fora,
      selfieArquivoId,
      dispositivo: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    if (fora && !duplicada) {
      await avisarPatroes(emp.clienteId, {
        chave: `fora-do-local:${marcacao.id}`,
        titulo: `${emp.nome.split(" ")[0]} marcou ${ROTULO_MARCACAO[marcacao.tipo].toLowerCase()} fora da casa`,
        texto: `${local?.distancia != null ? `A ${local.distancia} m do local cadastrado` : "Sem localização do GPS"}${corpo.origem === "OFFLINE" ? " (marcação feita sem internet)" : "; ela informou que estava na casa"}. A marcação ficou registrada.`,
        link: "/cliente/ponto",
      });
    }
    return NextResponse.json({
      ok: true,
      duplicada,
      foraDoLocal: fora,
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
