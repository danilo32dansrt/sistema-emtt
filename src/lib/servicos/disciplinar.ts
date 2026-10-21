import "server-only";
import type { OcorrenciaDisciplinar } from "@prisma/client";
import {
  addDias, diferencaDias, formatarCompetencia, hojeBrasil, recomendarMedida, riscoDisciplinar, situacaoChecklist,
  tipoFalta, type Gravidade, type Medida, type RegraFeriasParcial,
} from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { salvarBytes, sha256 } from "@/lib/arquivos";
import { MODELOS_DISCIPLINARES, termoRecusa, type ModeloDisciplinar } from "@/lib/pdf/disciplinar";
import { configuracao } from "@/lib/tabelas-db";
import { feriasDoEmpregado, validacoesDoEmpregado } from "./empregado";

export const STATUS_DISCIPLINAR: Record<string, { rotulo: string; cor: "cinza" | "amarelo" | "vermelho" | "verde" | "azul" }> = {
  REGISTRADA: { rotulo: "Registrada", cor: "azul" },
  AGUARDANDO_DEFESA: { rotulo: "Aguardando versão da empregada", cor: "amarelo" },
  EM_ANALISE_CONSULTOR: { rotulo: "Em análise pelo consultor", cor: "vermelho" },
  JUSTA_CAUSA_APROVADA: { rotulo: "Justa causa liberada", cor: "vermelho" },
  JUSTA_CAUSA_NEGADA: { rotulo: "Justa causa não recomendada", cor: "cinza" },
  MEDIDA_APLICADA: { rotulo: "Medida aplicada", cor: "verde" },
  ARQUIVADA: { rotulo: "Arquivada", cor: "cinza" },
};

const MEDIDAS_VALIDAS = ["MEDIDA_APLICADA", "JUSTA_CAUSA_APROVADA"];

/** Pendências do empregador que podem levar a rescisão indireta. */
async function pendenciasDoEmpregador(empregadoId: string, hoje: Date) {
  const cfg = await configuracao();
  const e = await prisma.empregado.findUniqueOrThrow({ where: { id: empregadoId }, include: { ferias: true, competencias: { where: { pagamentoConfirmado: false } } } });
  const lista: string[] = [];
  const daes = e.competencias.filter((c) => situacaoChecklist(c.ano, c.mes, c, hoje).atrasadas.includes("pagamentoConfirmado"));
  if (daes.length) lista.push(`DAE em atraso (${daes.map((c) => formatarCompetencia(c.ano, c.mes)).join(", ")})`);
  const { periodos } = feriasDoEmpregado(e, cfg.regraFeriasParcial as RegraFeriasParcial, hoje);
  if (periodos.some((p) => p.status === "VENCIDO")) lista.push("férias vencidas");
  const v = await validacoesDoEmpregado(e, hoje);
  if (v.some((x) => x.codigo === "SALARIO_ABAIXO_MINIMO")) lista.push("salário abaixo do mínimo proporcional");
  return lista;
}

/** Recomendação automática para uma ocorrência (com histórico, estabilidade e checagens). */
export async function recomendacaoDaOcorrencia(oc: OcorrenciaDisciplinar, hoje = hojeBrasil()) {
  const [cfg, emp, historico] = await Promise.all([
    configuracao(),
    prisma.empregado.findUniqueOrThrow({ where: { id: oc.empregadoId } }),
    prisma.ocorrenciaDisciplinar.findMany({ where: { empregadoId: oc.empregadoId, id: { not: oc.id }, status: { in: MEDIDAS_VALIDAS } } }),
  ]);
  return recomendarMedida({
    tipoFalta: oc.tipoFalta,
    gravidade: oc.gravidade as Gravidade,
    dataFato: oc.dataFato,
    dataCiencia: oc.dataCiencia,
    hoje,
    historico: historico.map((h) => ({ data: h.dataFato, tipoFalta: h.tipoFalta, medida: h.medida as Medida | null, diasSuspensao: h.diasSuspensao })),
    jaPunida: MEDIDAS_VALIDAS.includes(oc.status),
    estabilidade: emp.estabilidadeAte ? { motivo: emp.estabilidadeMotivo ?? "estabilidade", ate: emp.estabilidadeAte } : null,
    afastado: emp.situacao === "AFASTADO",
    pendenciasEmpregador: await pendenciasDoEmpregador(emp.id, hoje),
    mesesPeso: cfg.mesesPesoDisciplinar,
    diasAusencia: oc.tipoFalta === "ABANDONO" ? diferencaDias(oc.dataFato, hoje) + 1 : undefined,
  });
}

/** Gera um documento disciplinar em PDF, guarda e liga à ocorrência. */
export async function emitirDocumentoDisciplinar(ocId: string, modelo: ModeloDisciplinar | "RECUSA", usuarioId: string, documentoRecusado?: string) {
  const oc = await prisma.ocorrenciaDisciplinar.findUniqueOrThrow({ where: { id: ocId }, include: { cliente: true, empregado: true } });
  const partes = { cliente: oc.cliente, empregado: oc.empregado, oc };
  const bytes = modelo === "RECUSA" ? await termoRecusa(partes, documentoRecusado ?? "documento disciplinar") : await MODELOS_DISCIPLINARES[modelo].gerar(partes);
  const titulo = `${modelo === "RECUSA" ? "Termo de recusa de assinatura" : MODELOS_DISCIPLINARES[modelo].rotulo} — ${tipoFalta(oc.tipoFalta).rotulo}`;
  const arquivo = await salvarBytes(bytes, { nome: `${titulo} - ${oc.empregado.nome}.pdf`, mime: "application/pdf", clienteId: oc.clienteId, criadoPorId: usuarioId });
  const assinaEmpregado = ["ORIENTACAO_VERBAL", "ADVERTENCIA_ESCRITA", "SUSPENSAO", "CONVOCACAO", "JUSTA_CAUSA"].includes(modelo);
  const doc = await prisma.documento.create({
    data: {
      clienteId: oc.clienteId,
      empregadoId: oc.empregadoId,
      tipo: `DISCIPLINAR_${modelo}`,
      titulo,
      arquivoId: arquivo.id,
      hash: sha256(bytes),
      exigeAssinaturaEmpregado: assinaEmpregado,
      exigeAssinaturaCliente: modelo !== "RECUSA",
      visivelEmpregado: modelo !== "REGISTRO_OCORRENCIA",
      criadoPorId: usuarioId,
    },
  });
  await prisma.ocorrenciaDisciplinar.update({ where: { id: ocId }, data: { documentosIds: { push: doc.id }, ...(["ORIENTACAO_VERBAL", "ADVERTENCIA_ESCRITA", "SUSPENSAO", "JUSTA_CAUSA"].includes(modelo) ? { documentoId: doc.id } : {}) } });
  return doc;
}

/** Painel: ocorrências com risco por empregado e alertas (prazos, suspensões, assinaturas). */
export async function painelDisciplinar(clienteId?: string, hoje = hojeBrasil()) {
  const cfg = await configuracao();
  const ocorrencias = await prisma.ocorrenciaDisciplinar.findMany({
    where: clienteId ? { clienteId } : {},
    include: { empregado: { select: { id: true, nome: true } }, cliente: { select: { id: true, nome: true } } },
    orderBy: { dataFato: "desc" },
  });
  const docsIds = ocorrencias.map((o) => o.documentoId).filter(Boolean) as string[];
  const docs = await prisma.documento.findMany({ where: { id: { in: docsIds } }, include: { assinaturas: true } });

  const alertas: { tipo: "critico" | "aviso" | "info"; texto: string; ocorrenciaId: string }[] = [];
  for (const o of ocorrencias) {
    const nome = o.empregado.nome.split(" ")[0];
    if (["REGISTRADA", "AGUARDANDO_DEFESA"].includes(o.status)) {
      const dias = diferencaDias(o.dataCiencia, hoje);
      const limite = addDias(o.dataCiencia, 10);
      alertas.push({ tipo: dias > 10 ? "critico" : "aviso", texto: `${nome}: decidir a medida até ${limite.toISOString().slice(0, 10).split("-").reverse().join("/")} (imediatidade) — ${tipoFalta(o.tipoFalta).rotulo}`, ocorrenciaId: o.id });
      if (o.prazoDefesa && o.prazoDefesa < hoje && !o.versaoEmpregado) alertas.push({ tipo: "aviso", texto: `${nome}: prazo para a versão da empregada terminou — registre a versão ou que ela não quis se manifestar.`, ocorrenciaId: o.id });
    }
    if (o.status === "EM_ANALISE_CONSULTOR") alertas.push({ tipo: "critico", texto: `${nome}: dossiê de possível justa causa aguardando revisão do consultor.`, ocorrenciaId: o.id });
    if (o.medida === "SUSPENSAO" && o.inicioSuspensao && o.diasSuspensao) {
      const retorno = addDias(o.inicioSuspensao, o.diasSuspensao);
      if (retorno >= hoje && diferencaDias(hoje, retorno) <= 7) alertas.push({ tipo: "info", texto: `${nome}: fim da suspensão — retorno em ${retorno.toISOString().slice(0, 10).split("-").reverse().join("/")}.`, ocorrenciaId: o.id });
    }
    const d = docs.find((x) => x.id === o.documentoId);
    if (d && d.exigeAssinaturaEmpregado && !o.recusaAssinatura && !o.assinaturaForma && !d.assinaturas.some((a) => a.papel === "EMPREGADO")) {
      alertas.push({ tipo: "aviso", texto: `${nome}: assinatura da empregada pendente em "${d.titulo}".`, ocorrenciaId: o.id });
    }
  }
  const porEmpregado = new Map<string, { nome: string; cliente: string; ocorrencias: typeof ocorrencias }>();
  for (const o of ocorrencias) {
    const atual = porEmpregado.get(o.empregadoId) ?? { nome: o.empregado.nome, cliente: o.cliente.nome, ocorrencias: [] };
    atual.ocorrencias.push(o);
    porEmpregado.set(o.empregadoId, atual);
  }
  const riscos = [...porEmpregado.entries()].map(([id, v]) => {
    const r = riscoDisciplinar(v.ocorrencias.filter((o) => o.status !== "ARQUIVADA").map((o) => ({ data: o.dataFato, gravidade: o.gravidade as Gravidade })), hoje, cfg.mesesPesoDisciplinar);
    const recentes = v.ocorrencias.filter((o) => diferencaDias(o.dataFato, hoje) <= 90).length;
    if (recentes >= 3) alertas.push({ tipo: "aviso", texto: `${v.nome.split(" ")[0]}: ${recentes} ocorrências nos últimos 90 dias. Converse e alinhe as expectativas por escrito.`, ocorrenciaId: v.ocorrencias[0].id });
    return { empregadoId: id, ...v, ...r };
  });
  return { ocorrencias, alertas, riscos };
}
