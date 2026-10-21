"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { salvarUpload } from "@/lib/arquivos";
import { registrarAtividade } from "@/lib/atividade";
import { exigirConsultor, exigirPapel } from "@/lib/auth/sessao";
import {
  checarProporcionalidade, formatarData, hojeBrasil, NOMES_MEDIDA, periodoSuspensao, tipoFalta, TIPOS_FALTA, type Medida,
} from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { dadosDoForm, dataCampo, dataOpcional, texto, textoOpcional } from "@/lib/formularios";
import { emitirDocumentoDisciplinar, recomendacaoDaOcorrencia } from "@/lib/servicos/disciplinar";
import type { ModeloDisciplinar } from "@/lib/pdf/disciplinar";

/** Cliente (só os próprios empregados) ou consultor. */
async function autorizar(ocorrenciaOuEmpregado: { ocorrenciaId?: string; empregadoId?: string }) {
  const u = await exigirPapel("CLIENTE", "CONSULTOR");
  if (ocorrenciaOuEmpregado.ocorrenciaId) {
    const oc = await prisma.ocorrenciaDisciplinar.findUniqueOrThrow({ where: { id: ocorrenciaOuEmpregado.ocorrenciaId }, include: { empregado: true } });
    if (u.papel === "CLIENTE" && oc.clienteId !== u.clienteId) throw new Error("Sem permissão.");
    return { u, oc, emp: oc.empregado };
  }
  const emp = await prisma.empregado.findUniqueOrThrow({ where: { id: ocorrenciaOuEmpregado.empregadoId } });
  if (u.papel === "CLIENTE" && emp.clienteId !== u.clienteId) throw new Error("Sem permissão.");
  return { u, oc: null, emp };
}

function caminho(papel: string, id?: string) {
  const base = papel === "CONSULTOR" ? "/consultor/disciplinar" : "/cliente/disciplinar";
  return id ? `${base}/${id}` : base;
}

const CODIGOS = TIPOS_FALTA.map((t) => t.codigo) as [string, ...string[]];

/** Passos 1 e 2: registrar a ocorrência (fatos) e classificar a falta. */
export async function registrarOcorrencia(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  let destino: string;
  try {
    const d = z.object({
      empregadoId: z.string().min(1, "Escolha o empregado."),
      dataFato: dataCampo("a data do fato"),
      horaFato: textoOpcional,
      local: textoOpcional,
      dataCiencia: dataCampo("a data em que você soube"),
      descricao: texto("a descrição do fato", 20).refine((v) => v.length >= 20, "Descreva o fato com pelo menos 20 caracteres."),
      testemunhas: textoOpcional,
      tipoFalta: z.enum(CODIGOS),
      gravidade: z.enum(["", "leve", "media", "grave", "gravissima"]).optional(),
    }).parse(dadosDoForm(fd));
    const { u, emp } = await autorizar({ empregadoId: d.empregadoId });
    const hoje = hojeBrasil();
    if (d.dataFato > hoje) return { erro: "A data do fato não pode estar no futuro." };
    if (d.dataCiencia < d.dataFato) return { erro: "A data em que você soube não pode ser anterior ao fato." };
    const provas: string[] = [];
    for (const f of fd.getAll("provas")) {
      const a = await salvarUpload(f as File, { clienteId: emp.clienteId, criadoPorId: u.id });
      if (a) provas.push(a.id);
    }
    const gravidade = d.gravidade || tipoFalta(d.tipoFalta).gravidade;
    const oc = await prisma.ocorrenciaDisciplinar.create({
      data: {
        clienteId: emp.clienteId, empregadoId: emp.id, dataFato: d.dataFato, horaFato: d.horaFato, local: d.local, dataCiencia: d.dataCiencia,
        descricao: d.descricao, testemunhas: d.testemunhas, tipoFalta: d.tipoFalta, gravidade, provasIds: provas, criadoPorId: u.id,
      },
    });
    await prisma.ocorrenciaDisciplinar.update({ where: { id: oc.id }, data: { recomendacao: JSON.parse(JSON.stringify(await recomendacaoDaOcorrencia(oc))) } });
    await registrarAtividade({ usuarioId: u.id, clienteId: emp.clienteId, acao: "DISCIPLINAR", descricao: `Ocorrência registrada: ${tipoFalta(d.tipoFalta).rotulo} de ${emp.nome} em ${formatarData(d.dataFato)}${gravidade === "gravissima" ? " (GRAVÍSSIMA — consultor alertado)" : ""}`, entidade: "OcorrenciaDisciplinar", entidadeId: oc.id });
    destino = caminho(u.papel, oc.id);
  } catch (e) {
    return erroParaEstado(e);
  }
  redirect(destino);
}

/** Passo 3: convocar para esclarecimentos (gera PDF) ou registrar a versão da empregada. */
export async function convocarDefesa(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  try {
    const d = z.object({ ocorrenciaId: z.string(), prazoDefesa: dataCampo("o prazo") }).parse(dadosDoForm(fd));
    const { u, oc } = await autorizar({ ocorrenciaId: d.ocorrenciaId });
    await prisma.ocorrenciaDisciplinar.update({ where: { id: oc!.id }, data: { prazoDefesa: d.prazoDefesa, status: "AGUARDANDO_DEFESA" } });
    await emitirDocumentoDisciplinar(oc!.id, "CONVOCACAO", u.id);
    revalidatePath(caminho(u.papel, oc!.id));
    return { ok: true, mensagem: "Convocação gerada. Entregue à empregada e registre a versão dela até o prazo." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function registrarDefesa(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  try {
    const d = z.object({ ocorrenciaId: z.string(), versaoEmpregado: texto("a versão da empregada") }).parse(dadosDoForm(fd));
    const { u, oc } = await autorizar({ ocorrenciaId: d.ocorrenciaId });
    await prisma.ocorrenciaDisciplinar.update({ where: { id: oc!.id }, data: { versaoEmpregado: d.versaoEmpregado, defesaRegistradaEm: new Date(), status: oc!.status === "AGUARDANDO_DEFESA" ? "REGISTRADA" : oc!.status } });
    await registrarAtividade({ usuarioId: u.id, clienteId: oc!.clienteId, acao: "DISCIPLINAR", descricao: `Versão da empregada registrada na ocorrência de ${formatarData(oc!.dataFato)}` });
    revalidatePath(caminho(u.papel, oc!.id));
    return { ok: true, mensagem: "Versão da empregada registrada." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

/** Passos 4 a 6 e 8: confere checagens, aplica a medida, gera o documento e lança a suspensão na pré-folha. */
export async function aplicarMedida(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  try {
    const d = z.object({
      ocorrenciaId: z.string(),
      medida: z.enum(["ORIENTACAO_VERBAL", "ADVERTENCIA_ESCRITA", "SUSPENSAO", "JUSTA_CAUSA", "NENHUMA"]),
      diasSuspensao: z.string().optional().transform((v) => (v ? Number(v) : 0)),
      inicioSuspensao: dataOpcional,
      justificativaMedida: textoOpcional,
      cienteRiscos: z.string().optional(),
    }).parse(dadosDoForm(fd));
    const { u, oc, emp } = await autorizar({ ocorrenciaId: d.ocorrenciaId });
    if (!["REGISTRADA", "AGUARDANDO_DEFESA", "JUSTA_CAUSA_NEGADA"].includes(oc!.status)) return { erro: "Esta ocorrência já teve uma medida aplicada (não é permitido punir duas vezes o mesmo fato)." };

    if (d.medida === "NENHUMA") {
      await prisma.ocorrenciaDisciplinar.update({ where: { id: oc!.id }, data: { status: "ARQUIVADA", medida: "NENHUMA", justificativaMedida: d.justificativaMedida } });
      revalidatePath(caminho(u.papel));
      return { ok: true, mensagem: "Ocorrência arquivada sem medida." };
    }
    const rec = await recomendacaoDaOcorrencia(oc!);
    if (rec.bloqueado) return { erro: rec.checagens.filter((c) => c.tipo === "bloqueio").map((c) => c.mensagem).join(" ") };
    const prop = checarProporcionalidade(d.medida as Medida, rec.medida, d.diasSuspensao);
    const bloqueios = prop.filter((c) => c.tipo === "bloqueio");
    if (bloqueios.length) return { erro: bloqueios.map((c) => c.mensagem).join(" ") };
    const criticos = [...rec.checagens, ...prop].filter((c) => c.tipo === "critico");
    if (criticos.length && d.cienteRiscos !== "on") return { erro: `Confirme que está ciente dos riscos: ${criticos.map((c) => c.mensagem).join(" ")}` };
    if (prop.some((c) => c.tipo !== "ok") && d.medida !== rec.medida && !d.justificativaMedida && d.medida !== "JUSTA_CAUSA") return { erro: "Explique por que escolheu uma medida diferente da recomendada." };

    if (d.medida === "JUSTA_CAUSA") {
      // Trava obrigatória: o empregador não finaliza justa causa sozinho
      await prisma.ocorrenciaDisciplinar.update({ where: { id: oc!.id }, data: { status: "EM_ANALISE_CONSULTOR", medida: "JUSTA_CAUSA", justificativaMedida: d.justificativaMedida, recomendacao: JSON.parse(JSON.stringify(rec)) } });
      await registrarAtividade({ usuarioId: u.id, clienteId: oc!.clienteId, acao: "DISCIPLINAR", descricao: `Dossiê de possível justa causa de ${emp.nome} enviado ao consultor para revisão` });
      revalidatePath(caminho(u.papel, oc!.id));
      return { ok: true, mensagem: "Dossiê enviado ao consultor. A justa causa só é liberada após a revisão (recomendamos também a análise de um advogado)." };
    }

    let inicio = d.inicioSuspensao;
    if (d.medida === "SUSPENSAO") {
      if (!inicio) return { erro: "Informe o primeiro dia da suspensão." };
      if (inicio < hojeBrasil()) return { erro: "A suspensão deve começar hoje ou depois." };
    } else inicio = null;

    await prisma.ocorrenciaDisciplinar.update({
      where: { id: oc!.id },
      data: { medida: d.medida, diasSuspensao: d.medida === "SUSPENSAO" ? d.diasSuspensao : null, inicioSuspensao: inicio, justificativaMedida: d.justificativaMedida, recomendacao: JSON.parse(JSON.stringify(rec)), status: "MEDIDA_APLICADA", aplicadaEm: new Date() },
    });
    await emitirDocumentoDisciplinar(oc!.id, d.medida as ModeloDisciplinar, u.id);

    if (d.medida === "SUSPENSAO" && inicio) {
      const per = periodoSuspensao(inicio, d.diasSuspensao);
      for (const m of per.porMes) {
        const nota = `Suspensão disciplinar: ${m.dias} dia(s) — lançar no eSocial como falta (desconto)`;
        await prisma.lancamentoMensal.upsert({
          where: { empregadoId_ano_mes: { empregadoId: emp.id, ano: m.ano, mes: m.mes } },
          create: { empregadoId: emp.id, ano: m.ano, mes: m.mes, diasSuspensao: m.dias, origem: "CONSULTOR", observacoes: nota, enviadoPorId: u.id },
          update: { diasSuspensao: { increment: m.dias }, observacoes: nota },
        });
      }
    }
    await prisma.historicoEmpregado.create({ data: { empregadoId: emp.id, data: hojeBrasil(), tipo: "OCORRENCIA", descricao: `${NOMES_MEDIDA[d.medida as Medida]}${d.medida === "SUSPENSAO" ? ` de ${d.diasSuspensao} dia(s)` : ""} — ${tipoFalta(oc!.tipoFalta).rotulo} (${formatarData(oc!.dataFato)})` } });
    await registrarAtividade({ usuarioId: u.id, clienteId: oc!.clienteId, acao: "DISCIPLINAR", descricao: `${NOMES_MEDIDA[d.medida as Medida]} aplicada a ${emp.nome}` });
    revalidatePath(caminho(u.papel, oc!.id));
    return { ok: true, mensagem: "Medida aplicada e documento gerado. Colha a assinatura da empregada." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

/** Passo 7: assinatura impressa (upload) ou recusa com duas testemunhas. */
export async function registrarAssinaturaDisciplinar(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  try {
    const d = z.object({ ocorrenciaId: z.string(), forma: z.enum(["IMPRESSA", "RECUSA"]), testemunhasRecusa: textoOpcional }).parse(dadosDoForm(fd));
    const { u, oc } = await autorizar({ ocorrenciaId: d.ocorrenciaId });
    const doc = oc!.documentoId ? await prisma.documento.findUnique({ where: { id: oc!.documentoId } }) : null;
    if (!doc) return { erro: "Gere o documento da medida primeiro." };
    if (d.forma === "IMPRESSA") {
      const arq = await salvarUpload(fd.get("arquivo") as File | null, { clienteId: oc!.clienteId, criadoPorId: u.id, obrigatorio: true });
      await prisma.documento.create({ data: { clienteId: oc!.clienteId, empregadoId: oc!.empregadoId, tipo: "DISCIPLINAR_ASSINADO", titulo: `${doc.titulo} (assinado)`, arquivoId: arq!.id, hash: arq!.sha256, criadoPorId: u.id } });
      await prisma.ocorrenciaDisciplinar.update({ where: { id: oc!.id }, data: { assinaturaForma: "IMPRESSA" } });
    } else {
      const nomes = (d.testemunhasRecusa ?? "").split(/[\n;]+/).map((x) => x.trim()).filter(Boolean);
      if (nomes.length < 2) return { erro: "Informe nome e CPF de duas testemunhas (uma por linha)." };
      await prisma.ocorrenciaDisciplinar.update({ where: { id: oc!.id }, data: { recusaAssinatura: true, testemunhasRecusa: nomes.join("; "), assinaturaForma: "RECUSA" } });
      await emitirDocumentoDisciplinar(oc!.id, "RECUSA", u.id, doc.titulo);
    }
    await registrarAtividade({ usuarioId: u.id, clienteId: oc!.clienteId, acao: "DISCIPLINAR", descricao: d.forma === "RECUSA" ? "Recusa de assinatura registrada com testemunhas" : "Documento disciplinar assinado (impresso) arquivado" });
    revalidatePath(caminho(u.papel, oc!.id));
    return { ok: true, mensagem: d.forma === "RECUSA" ? "Termo de recusa gerado. Colha a assinatura das testemunhas." : "Documento assinado arquivado (guarda de 5 anos)." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function gerarModeloDisciplinar(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  try {
    const d = z.object({ ocorrenciaId: z.string(), modelo: z.enum(["REGISTRO_OCORRENCIA", "CONVOCACAO", "ABANDONO"]) }).parse(dadosDoForm(fd));
    const { u, oc } = await autorizar({ ocorrenciaId: d.ocorrenciaId });
    if (d.modelo === "ABANDONO" && oc!.tipoFalta !== "ABANDONO") return { erro: "A notificação de abandono só se aplica a ocorrências de abandono de emprego." };
    await emitirDocumentoDisciplinar(oc!.id, d.modelo, u.id);
    revalidatePath(caminho(u.papel, oc!.id));
    return { ok: true, mensagem: "Documento gerado." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

/** Revisão do consultor no dossiê de justa causa (trava obrigatória). */
export async function revisarJustaCausa(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = z.object({ ocorrenciaId: z.string(), decisao: z.enum(["APROVAR", "NEGAR"]), parecer: texto("o parecer"), revisadoAdvogado: z.string().optional() }).parse(dadosDoForm(fd));
    const oc = await prisma.ocorrenciaDisciplinar.findUniqueOrThrow({ where: { id: d.ocorrenciaId }, include: { empregado: true } });
    if (oc.status !== "EM_ANALISE_CONSULTOR") return { erro: "Este dossiê não está em análise." };
    if (d.decisao === "APROVAR" && d.revisadoAdvogado !== "on") return { erro: "Confirme que o caso foi analisado (ou que o cliente foi orientado a consultar um advogado)." };
    await prisma.ocorrenciaDisciplinar.update({
      where: { id: oc.id },
      data: { parecerConsultor: d.parecer, revisadoPorId: u.id, revisadoEm: new Date(), status: d.decisao === "APROVAR" ? "JUSTA_CAUSA_APROVADA" : "JUSTA_CAUSA_NEGADA", ...(d.decisao === "APROVAR" ? { aplicadaEm: new Date() } : { medida: null }) },
    });
    if (d.decisao === "APROVAR") {
      await emitirDocumentoDisciplinar(oc.id, "JUSTA_CAUSA", u.id);
      await prisma.historicoEmpregado.create({ data: { empregadoId: oc.empregadoId, data: hojeBrasil(), tipo: "OCORRENCIA", descricao: `Justa causa liberada pelo consultor — ${tipoFalta(oc.tipoFalta).rotulo}` } });
    }
    await registrarAtividade({ usuarioId: u.id, clienteId: oc.clienteId, acao: "DISCIPLINAR", descricao: `Dossiê de justa causa de ${oc.empregado.nome} ${d.decisao === "APROVAR" ? "aprovado" : "não aprovado"} pelo consultor` });
    revalidatePath(`/consultor/disciplinar/${oc.id}`);
    return { ok: true, mensagem: d.decisao === "APROVAR" ? "Justa causa liberada; comunicação gerada. Registre o desligamento na página do empregado." : "Parecer enviado ao cliente; ele pode aplicar outra medida." };
  } catch (e) {
    return erroParaEstado(e);
  }
}
