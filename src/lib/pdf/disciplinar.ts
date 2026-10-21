import type { Cliente, Empregado, OcorrenciaDisciplinar } from "@prisma/client";
import { addDias, formatarCpf, formatarData, periodoSuspensao, tipoFalta } from "@/lib/calculos";
import { DocPdf } from "./base";

type Oc = OcorrenciaDisciplinar;
interface P {
  cliente: Cliente;
  empregado: Empregado;
  oc: Oc;
}

const RODAPE = "As recomendações são orientativas e não substituem análise de advogado em casos graves.";

function hoje(p: P) {
  return `${p.cliente.cidade || "________"}, ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" })}.`;
}

function cabecalho(doc: DocPdf, p: P) {
  doc.campos([
    ["Empregador(a)", `${p.cliente.nome} — CPF ${formatarCpf(p.cliente.cpf)}`],
    ["Empregado(a)", `${p.empregado.nome} — CPF ${formatarCpf(p.empregado.cpf)} — ${p.empregado.funcao}`],
  ]);
}

function fato(doc: DocPdf, oc: Oc) {
  doc.campos([
    ["Data do fato", `${formatarData(oc.dataFato)}${oc.horaFato ? ` às ${oc.horaFato}` : ""}${oc.local ? ` — ${oc.local}` : ""}`],
    ["Tipo de falta", tipoFalta(oc.tipoFalta).rotulo],
  ]);
  doc.paragrafo("Descrição objetiva do fato:", { negrito: true, espaco: 2 });
  doc.paragrafo(oc.descricao);
  if (oc.testemunhas) doc.paragrafo(`Testemunhas: ${oc.testemunhas}`);
}

function assinaturasPadrao(doc: DocPdf, p: P) {
  doc.paragrafo(hoje(p));
  doc.assinaturas([{ nome: p.cliente.nome, papel: "Empregador(a)" }, { nome: p.empregado.nome, papel: "Ciente — Empregado(a)" }]);
}

export async function registroOcorrencia(p: P) {
  const doc = await DocPdf.criar({ titulo: "Registro de Ocorrência", rodape: RODAPE });
  doc.titulo("REGISTRO DE OCORRÊNCIA");
  cabecalho(doc, p);
  fato(doc, p.oc);
  if (p.oc.versaoEmpregado) {
    doc.paragrafo("Versão do(a) empregado(a):", { negrito: true, espaco: 2 });
    doc.paragrafo(p.oc.versaoEmpregado);
  }
  doc.paragrafo(`Registro feito em ${formatarData(p.oc.criadoEm)}; o(a) empregador(a) tomou ciência do fato em ${formatarData(p.oc.dataCiencia)}.`, { tamanho: 9 });
  doc.paragrafo(hoje(p));
  doc.assinaturas([{ nome: p.cliente.nome, papel: "Empregador(a)" }]);
  return doc.salvar();
}

export async function orientacaoVerbal(p: P) {
  const doc = await DocPdf.criar({ titulo: "Termo de Orientação Verbal", rodape: RODAPE });
  doc.titulo("TERMO DE ORIENTAÇÃO VERBAL (REGISTRO INTERNO)");
  cabecalho(doc, p);
  fato(doc, p.oc);
  doc.paragrafo(`Nesta data, o(a) empregado(a) foi orientado(a) verbalmente sobre o fato acima e sobre a forma correta de proceder, sendo informado(a) de que a repetição poderá gerar advertência escrita. Este termo serve apenas como registro da conversa.`);
  assinaturasPadrao(doc, p);
  return doc.salvar();
}

export async function advertenciaEscrita(p: P) {
  const doc = await DocPdf.criar({ titulo: "Advertência Disciplinar", rodape: RODAPE });
  doc.titulo("ADVERTÊNCIA DISCIPLINAR");
  cabecalho(doc, p);
  doc.paragrafo(`Prezado(a) ${p.empregado.nome},`);
  doc.paragrafo("Pela presente, fica V.Sa. ADVERTIDO(A) em razão do fato descrito abaixo, que contraria as obrigações do contrato de trabalho:");
  fato(doc, p.oc);
  doc.paragrafo("Solicitamos que tal conduta não se repita. A reincidência poderá acarretar a aplicação de penalidades mais severas, como suspensão e, em último caso, a dispensa por justa causa, conforme a Lei Complementar 150/2015 (art. 27) e a CLT.");
  doc.paragrafo("A assinatura deste documento indica apenas ciência do seu conteúdo, e não concordância.", { tamanho: 9 });
  assinaturasPadrao(doc, p);
  return doc.salvar();
}

export async function suspensao(p: P) {
  const dias = p.oc.diasSuspensao ?? 1;
  const per = periodoSuspensao(p.oc.inicioSuspensao ?? addDias(new Date(), 1), dias);
  const doc = await DocPdf.criar({ titulo: "Suspensão Disciplinar", rodape: RODAPE });
  doc.titulo("SUSPENSÃO DISCIPLINAR");
  cabecalho(doc, p);
  doc.paragrafo(`Prezado(a) ${p.empregado.nome},`);
  doc.paragrafo(`Comunicamos que V.Sa. está SUSPENSO(A) de suas atividades por ${dias} dia(s), em razão do fato descrito abaixo:`);
  fato(doc, p.oc);
  doc.campos([
    ["Início da suspensão", formatarData(per.inicio)],
    ["Último dia de suspensão", formatarData(per.fim)],
    ["Retorno ao trabalho", formatarData(per.retorno)],
    ["Dias descontados", `${dias} dia(s), com o respectivo desconto salarial`],
  ]);
  doc.paragrafo("A suspensão não pode ultrapassar 30 dias (CLT, art. 474). A reincidência poderá acarretar a dispensa por justa causa. A assinatura indica apenas ciência.", { tamanho: 9 });
  assinaturasPadrao(doc, p);
  return doc.salvar();
}

export async function termoRecusa(p: P, documento: string) {
  const doc = await DocPdf.criar({ titulo: "Termo de Recusa de Assinatura", rodape: RODAPE });
  doc.titulo("TERMO DE RECUSA DE ASSINATURA");
  cabecalho(doc, p);
  doc.paragrafo(`Declaramos, para os devidos fins, que nesta data o(a) empregado(a) ${p.empregado.nome} foi comunicado(a) do conteúdo do documento "${documento}", referente ao fato de ${formatarData(p.oc.dataFato)}, tendo sido lido em voz alta na presença das testemunhas abaixo, e recusou-se a assiná-lo.`);
  if (p.oc.testemunhasRecusa) doc.paragrafo(`Testemunhas: ${p.oc.testemunhasRecusa}`);
  doc.paragrafo(hoje(p));
  doc.assinaturas([{ nome: p.cliente.nome, papel: "Empregador(a)" }]);
  doc.assinaturas([{ nome: "Testemunha 1", papel: "Nome, CPF e assinatura" }, { nome: "Testemunha 2", papel: "Nome, CPF e assinatura" }]);
  return doc.salvar();
}

export async function convocacao(p: P) {
  const prazo = p.oc.prazoDefesa ?? addDias(new Date(), 3);
  const doc = await DocPdf.criar({ titulo: "Convocação para Esclarecimentos", rodape: RODAPE });
  doc.titulo("CONVOCAÇÃO PARA ESCLARECIMENTOS");
  cabecalho(doc, p);
  doc.paragrafo(`Prezado(a) ${p.empregado.nome},`);
  doc.paragrafo(`Fica V.Sa. convidado(a) a apresentar, até ${formatarData(prazo)}, sua versão sobre o fato abaixo, verbalmente ou por escrito. Seu relato será registrado e considerado antes de qualquer decisão.`);
  fato(doc, p.oc);
  assinaturasPadrao(doc, p);
  return doc.salvar();
}

export async function comunicacaoJustaCausa(p: P) {
  const t = tipoFalta(p.oc.tipoFalta);
  const doc = await DocPdf.criar({ titulo: "Comunicação de Dispensa por Justa Causa", rodape: RODAPE });
  doc.titulo("COMUNICAÇÃO DE DISPENSA POR JUSTA CAUSA");
  cabecalho(doc, p);
  doc.paragrafo(`Prezado(a) ${p.empregado.nome},`);
  doc.paragrafo(`Comunicamos que, a partir desta data, fica rescindido o seu contrato de trabalho por JUSTA CAUSA, com fundamento no art. 27${t.art27 ? `, inciso ${t.art27}` : ""}, da Lei Complementar 150/2015, em razão do fato a seguir:`);
  fato(doc, p.oc);
  doc.paragrafo("As verbas rescisórias devidas (saldo de salário e férias vencidas, se houver) serão pagas em até 10 dias (CLT, art. 477, § 6º).");
  if (p.oc.parecerConsultor) doc.paragrafo(`Revisado pela consultoria em ${p.oc.revisadoEm ? formatarData(p.oc.revisadoEm) : ""}.`, { tamanho: 8 });
  assinaturasPadrao(doc, p);
  doc.assinaturas([{ nome: "Testemunha 1", papel: "Nome e CPF" }, { nome: "Testemunha 2", papel: "Nome e CPF" }]);
  return doc.salvar();
}

export async function notificacaoAbandono(p: P) {
  const doc = await DocPdf.criar({ titulo: "Notificação de Abandono de Emprego", rodape: RODAPE });
  doc.titulo("NOTIFICAÇÃO PARA RETORNO AO TRABALHO");
  cabecalho(doc, p);
  doc.paragrafo(`Prezado(a) ${p.empregado.nome},`);
  doc.paragrafo(`Constatamos sua ausência injustificada ao trabalho desde ${formatarData(p.oc.dataFato)}. Solicitamos que retorne ao trabalho ou justifique suas faltas no prazo de 48 horas a contar do recebimento desta notificação.`);
  doc.paragrafo("A ausência injustificada por 30 dias corridos ou mais caracteriza abandono de emprego, hipótese de dispensa por justa causa (LC 150/2015, art. 27, IX).");
  doc.paragrafo("Recomenda-se enviar esta notificação por meio com comprovação de recebimento (carta com AR, e-mail e WhatsApp), guardando os comprovantes.", { tamanho: 9 });
  doc.paragrafo(hoje(p));
  doc.assinaturas([{ nome: p.cliente.nome, papel: "Empregador(a)" }]);
  return doc.salvar();
}

export const MODELOS_DISCIPLINARES = {
  REGISTRO_OCORRENCIA: { rotulo: "Registro de ocorrência", gerar: registroOcorrencia },
  ORIENTACAO_VERBAL: { rotulo: "Termo de orientação verbal", gerar: orientacaoVerbal },
  ADVERTENCIA_ESCRITA: { rotulo: "Advertência escrita", gerar: advertenciaEscrita },
  SUSPENSAO: { rotulo: "Suspensão disciplinar", gerar: suspensao },
  CONVOCACAO: { rotulo: "Convocação para esclarecimentos", gerar: convocacao },
  JUSTA_CAUSA: { rotulo: "Comunicação de dispensa por justa causa", gerar: comunicacaoJustaCausa },
  ABANDONO: { rotulo: "Notificação de abandono de emprego", gerar: notificacaoAbandono },
} as const;

export type ModeloDisciplinar = keyof typeof MODELOS_DISCIPLINARES;
