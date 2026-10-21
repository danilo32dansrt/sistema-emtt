import { addMeses, diferencaDias, formatarData, soData } from "./datas";

/**
 * Gestão disciplinar do empregado doméstico.
 * Base: LC 150/2015, art. 27 (justa causa) e CLT subsidiária (art. 19); suspensão
 * máxima de 30 dias (CLT, art. 474). Princípios: imediatidade, proporcionalidade,
 * gradação, non bis in idem, não discriminação e vínculo com o contrato.
 *
 * As recomendações são orientativas e não substituem análise de advogado em casos graves.
 */

export type Gravidade = "leve" | "media" | "grave" | "gravissima";
export type Medida = "ORIENTACAO_VERBAL" | "ADVERTENCIA_ESCRITA" | "SUSPENSAO" | "JUSTA_CAUSA";

export const NOMES_MEDIDA: Record<Medida | "NENHUMA", string> = {
  ORIENTACAO_VERBAL: "Orientação verbal registrada",
  ADVERTENCIA_ESCRITA: "Advertência escrita",
  SUSPENSAO: "Suspensão disciplinar",
  JUSTA_CAUSA: "Encaminhar ao consultor (possível justa causa)",
  NENHUMA: "Nenhuma medida (arquivar)",
};

const NIVEL: Record<Medida, number> = { ORIENTACAO_VERBAL: 1, ADVERTENCIA_ESCRITA: 2, SUSPENSAO: 3, JUSTA_CAUSA: 4 };

export interface TipoFalta {
  codigo: string;
  rotulo: string;
  gravidade: Gravidade;
  /** Inciso do art. 27 da LC 150/2015 que pode se aplicar (em caso grave ou reiterado). */
  art27?: string;
  exemplo: string;
}

export const TIPOS_FALTA: TipoFalta[] = [
  { codigo: "ATRASO", rotulo: "Atraso", gravidade: "leve", art27: "V — desídia (se reiterado)", exemplo: "Chegou às 9h10, quando o horário combinado é 8h." },
  { codigo: "FALTA_INJUSTIFICADA", rotulo: "Falta injustificada", gravidade: "leve", art27: "V — desídia (se reiterado)", exemplo: "Não compareceu na segunda-feira e não avisou nem apresentou atestado." },
  { codigo: "NEGLIGENCIA", rotulo: "Negligência no serviço", gravidade: "media", art27: "V — desídia", exemplo: "Deixou o fogão ligado e saiu da cozinha por 40 minutos." },
  { codigo: "DESCUMPRIMENTO_ORDEM", rotulo: "Descumprimento de ordem", gravidade: "media", art27: "VIII — indisciplina ou insubordinação", exemplo: "Foi orientada a não receber visitas no trabalho e recebeu." },
  { codigo: "DESRESPEITO", rotulo: "Desrespeito", gravidade: "media", art27: "XI — ofensa ao empregador ou família (se grave)", exemplo: "Respondeu aos gritos ao ser chamada para uma tarefa." },
  { codigo: "USO_INDEVIDO_BENS", rotulo: "Uso indevido de bens da casa", gravidade: "media", art27: "III — mau procedimento", exemplo: "Usou o carro da família sem autorização." },
  { codigo: "CELULAR_EXCESSIVO", rotulo: "Uso excessivo do celular", gravidade: "leve", exemplo: "Ficou 2 horas no celular deixando de cuidar da criança." },
  { codigo: "INSUBORDINACAO", rotulo: "Insubordinação (recusa direta de ordem)", gravidade: "grave", art27: "VIII — indisciplina ou insubordinação", exemplo: "Recusou-se a cumprir uma tarefa da função, dizendo que não faria." },
  { codigo: "EMBRIAGUEZ", rotulo: "Embriaguez em serviço", gravidade: "grave", art27: "VI — embriaguez habitual ou em serviço", exemplo: "Chegou ao trabalho com sinais claros de embriaguez." },
  { codigo: "OFENSA", rotulo: "Ofensa ou agressão", gravidade: "gravissima", art27: "X/XI — ato lesivo à honra ou ofensas físicas", exemplo: "Xingou e empurrou um membro da família." },
  { codigo: "MAUS_TRATOS", rotulo: "Maus-tratos a criança, idoso, enfermo ou pessoa com deficiência", gravidade: "gravissima", art27: "I — maus-tratos", exemplo: "Câmera registrou a criança sendo agredida." },
  { codigo: "IMPROBIDADE", rotulo: "Improbidade (furto, fraude, desonestidade)", gravidade: "gravissima", art27: "II — ato de improbidade", exemplo: "Foi vista retirando dinheiro da carteira do empregador." },
  { codigo: "JOGOS_AZAR", rotulo: "Prática constante de jogos de azar", gravidade: "grave", art27: "XII — jogos de azar", exemplo: "Joga apostas durante o expediente, todos os dias." },
  { codigo: "ABANDONO", rotulo: "Abandono de emprego (30 dias ou mais de ausência)", gravidade: "gravissima", art27: "IX — abandono de emprego", exemplo: "Não aparece há 32 dias e não responde às mensagens." },
  { codigo: "OUTRA", rotulo: "Outra falta", gravidade: "leve", exemplo: "Descreva o fato com detalhes." },
];

export function tipoFalta(codigo: string): TipoFalta {
  return TIPOS_FALTA.find((t) => t.codigo === codigo) ?? TIPOS_FALTA[TIPOS_FALTA.length - 1];
}

export interface OcorrenciaAnterior {
  data: Date;
  tipoFalta: string;
  medida: Medida | null;
  diasSuspensao?: number | null;
}

export interface EntradaRecomendacao {
  tipoFalta: string;
  /** Gravidade ajustada pelo empregador (opcional; padrão = a do tipo). */
  gravidade?: Gravidade;
  dataFato: Date;
  dataCiencia: Date;
  hoje: Date;
  historico: OcorrenciaAnterior[];
  /** Esta mesma falta já foi punida? (non bis in idem) */
  jaPunida?: boolean;
  estabilidade?: { motivo: string; ate: Date } | null;
  afastado?: boolean;
  /** Indícios de que o empregador descumpriu obrigações (salário/DAE atrasado, férias vencidas...). */
  pendenciasEmpregador?: string[];
  /** Meses em que medidas antigas pesam integralmente (padrão 12). */
  mesesPeso?: number;
  diasAusencia?: number;
}

export interface Checagem {
  tipo: "bloqueio" | "critico" | "aviso" | "ok";
  mensagem: string;
}

export interface Recomendacao {
  medida: Medida;
  diasSuspensao: number;
  explicacao: string[];
  checagens: Checagem[];
  bloqueado: boolean;
  pontuacaoHistorico: number;
  diasDesdeCiencia: number;
}

/** Recomenda a medida (gradação) e faz as checagens de segurança antes de emitir. */
export function recomendarMedida(e: EntradaRecomendacao): Recomendacao {
  const tipo = tipoFalta(e.tipoFalta);
  const gravidade = e.gravidade ?? tipo.gravidade;
  const mesesPeso = e.mesesPeso ?? 12;
  const limiteRecente = addMeses(soData(e.hoje), -mesesPeso);
  const explicacao: string[] = [];
  const checagens: Checagem[] = [];

  const recentes = e.historico.filter((h) => h.medida && h.data >= limiteRecente);
  const antigas = e.historico.filter((h) => h.medida && h.data < limiteRecente);
  const conta = (lista: OcorrenciaAnterior[], m: Medida) => lista.filter((h) => h.medida === m).length;
  const advRec = conta(recentes, "ADVERTENCIA_ESCRITA");
  const suspRec = conta(recentes, "SUSPENSAO");
  const oriRec = conta(recentes, "ORIENTACAO_VERBAL");
  const mesmoTipoRec = recentes.filter((h) => h.tipoFalta === tipo.codigo).length;
  const pontuacaoHistorico = oriRec * 0.5 + advRec * 1 + suspRec * 2 + antigas.reduce((t, h) => t + (h.medida === "SUSPENSAO" ? 0.5 : 0.25), 0);

  if (recentes.length) explicacao.push(`Nos últimos ${mesesPeso} meses há ${oriRec} orientação(ões), ${advRec} advertência(s) e ${suspRec} suspensão(ões).`);
  else explicacao.push(`Não há medidas disciplinares nos últimos ${mesesPeso} meses.`);
  if (antigas.length) explicacao.push(`${antigas.length} medida(s) com mais de ${mesesPeso} meses pesam menos na recomendação.`);

  let medida: Medida;
  let dias = 0;
  if (gravidade === "gravissima") {
    medida = "JUSTA_CAUSA";
    explicacao.push(`Falta gravíssima${tipo.art27 ? ` (LC 150, art. 27, ${tipo.art27})` : ""}: pode justificar a dispensa por justa causa mesmo sem punições anteriores, mas exige provas fortes e revisão do consultor/advogado.`);
  } else if (gravidade === "grave") {
    if (suspRec >= 1) {
      medida = "JUSTA_CAUSA";
      explicacao.push("Falta grave com suspensão recente: a gradação já foi percorrida; encaminhe ao consultor para avaliar justa causa.");
    } else {
      medida = "SUSPENSAO";
      dias = advRec >= 1 ? 5 : 3;
      explicacao.push(`Falta grave: a suspensão de ${dias} dias é proporcional${advRec ? " (já houve advertência)" : ""}.`);
    }
  } else if (gravidade === "media") {
    if (suspRec >= 2) {
      medida = "JUSTA_CAUSA";
      explicacao.push("Já houve 2 suspensões recentes: a reincidência pode caracterizar desídia ou indisciplina (art. 27, V e VIII). Encaminhe ao consultor.");
    } else if (suspRec === 1) {
      medida = "SUSPENSAO";
      dias = 5;
      explicacao.push("Já houve suspensão recente: a próxima etapa é uma suspensão mais longa (5 dias).");
    } else if (advRec >= 1) {
      medida = "SUSPENSAO";
      dias = advRec >= 2 ? 3 : 2;
      explicacao.push(`Já houve advertência escrita: a gradação indica suspensão de ${dias} dia(s).`);
    } else {
      medida = "ADVERTENCIA_ESCRITA";
      explicacao.push("Primeira falta de gravidade média: advertência escrita, com a descrição do fato.");
    }
  } else {
    if (suspRec >= 2 || (suspRec >= 1 && mesmoTipoRec >= 3)) {
      medida = "JUSTA_CAUSA";
      explicacao.push("Faltas leves repetidas mesmo após suspensões podem caracterizar desídia (art. 27, V). Encaminhe ao consultor.");
    } else if (suspRec === 1) {
      medida = "SUSPENSAO";
      dias = 3;
      explicacao.push("Reincidência após suspensão: nova suspensão, um pouco maior (3 dias).");
    } else if (advRec >= 1) {
      medida = "SUSPENSAO";
      dias = 1;
      explicacao.push("Já houve advertência escrita: a gradação indica suspensão de 1 dia.");
    } else if (oriRec >= 1 || mesmoTipoRec >= 1) {
      medida = "ADVERTENCIA_ESCRITA";
      explicacao.push("Já houve orientação anterior: agora cabe advertência escrita.");
    } else {
      medida = "ORIENTACAO_VERBAL";
      explicacao.push("Primeira falta leve: converse com a empregada e registre a orientação.");
    }
  }

  // Checagens de segurança
  const diasDesdeCiencia = diferencaDias(e.dataCiencia, e.hoje);
  if (e.dataFato > e.hoje) checagens.push({ tipo: "bloqueio", mensagem: "A data do fato está no futuro." });
  if (e.dataCiencia < e.dataFato) checagens.push({ tipo: "bloqueio", mensagem: "A data em que você soube da falta não pode ser anterior ao fato." });
  if (diasDesdeCiencia > 30) checagens.push({ tipo: "critico", mensagem: `Já se passaram ${diasDesdeCiencia} dias desde que você soube da falta. Punir agora tem alto risco de ser considerado perdão tácito (falta de imediatidade).` });
  else if (diasDesdeCiencia > 10) checagens.push({ tipo: "aviso", mensagem: `Já se passaram ${diasDesdeCiencia} dias desde que você soube da falta. Aplique a medida o quanto antes (imediatidade).` });
  if (e.jaPunida) checagens.push({ tipo: "bloqueio", mensagem: "Esta falta já foi punida. Não é permitido punir duas vezes o mesmo fato (non bis in idem)." });
  if (e.afastado) checagens.push({ tipo: "bloqueio", mensagem: "A empregada está afastada (atestado/INSS). Aguarde o retorno para aplicar a medida." });
  if (e.estabilidade && e.estabilidade.ate >= e.hoje) {
    checagens.push({ tipo: medida === "JUSTA_CAUSA" ? "critico" : "aviso", mensagem: `Empregada com estabilidade (${e.estabilidade.motivo}) até ${formatarData(e.estabilidade.ate)}. A justa causa é possível, mas será analisada com muito rigor pela Justiça — consulte o consultor.` });
  }
  if (e.pendenciasEmpregador?.length) {
    checagens.push({ tipo: "critico", mensagem: `Atenção: há indícios de obrigações do empregador em atraso (${e.pendenciasEmpregador.join("; ")}). Isso pode levar a empregada a pedir rescisão indireta (LC 150, art. 27, parágrafo único). Regularize antes.` });
  }
  if (tipo.codigo === "ABANDONO" && (e.diasAusencia ?? 0) < 30) {
    checagens.push({ tipo: "bloqueio", mensagem: `Abandono de emprego exige pelo menos 30 dias corridos de ausência injustificada (art. 27, IX). Informados: ${e.diasAusencia ?? 0} dia(s). Envie antes a notificação para retorno.` });
  }
  if (dias > 30) checagens.push({ tipo: "bloqueio", mensagem: "A suspensão não pode passar de 30 dias (CLT, art. 474)." });
  if (!checagens.length) checagens.push({ tipo: "ok", mensagem: "Nenhum impedimento encontrado nas checagens automáticas." });

  return {
    medida,
    diasSuspensao: dias,
    explicacao,
    checagens,
    bloqueado: checagens.some((c) => c.tipo === "bloqueio"),
    pontuacaoHistorico,
    diasDesdeCiencia,
  };
}

/** Confere a medida escolhida pelo empregador contra a recomendada. */
export function checarProporcionalidade(escolhida: Medida, recomendada: Medida, diasSuspensao = 0): Checagem[] {
  const r: Checagem[] = [];
  if (escolhida === "SUSPENSAO" && (diasSuspensao < 1 || diasSuspensao > 30)) r.push({ tipo: "bloqueio", mensagem: "A suspensão deve ter de 1 a 30 dias (CLT, art. 474)." });
  if (escolhida === "SUSPENSAO" && diasSuspensao > 10) r.push({ tipo: "aviso", mensagem: "Suspensões longas costumam ser vistas como desproporcionais. Prefira até 5 dias, salvo caso muito grave." });
  const diff = NIVEL[escolhida] - NIVEL[recomendada];
  if (diff >= 2) r.push({ tipo: "critico", mensagem: `A medida escolhida é bem mais severa que a recomendada (${NOMES_MEDIDA[recomendada]}). Isso pode ser considerado desproporcional e anulado na Justiça.` });
  else if (diff === 1) r.push({ tipo: "aviso", mensagem: `A medida escolhida é mais severa que a recomendada (${NOMES_MEDIDA[recomendada]}). Explique o motivo no campo de justificativa.` });
  if (escolhida === "JUSTA_CAUSA") r.push({ tipo: "aviso", mensagem: "A justa causa não é aplicada pelo empregador sozinho: o dossiê vai para revisão do consultor." });
  return r;
}

const PESO: Record<Gravidade, number> = { leve: 1, media: 2, grave: 4, gravissima: 8 };

/** Pontuação de risco disciplinar (frequência e gravidade dos últimos 12 meses). */
export function riscoDisciplinar(ocorrencias: { data: Date; gravidade: Gravidade }[], hoje: Date, mesesPeso = 12) {
  const limite = addMeses(soData(hoje), -mesesPeso);
  const pontos = ocorrencias.reduce((t, o) => t + PESO[o.gravidade] * (o.data >= limite ? 1 : 0.25), 0);
  const nivel = pontos >= 10 ? "alto" : pontos >= 4 ? "medio" : "baixo";
  return { pontos, nivel: nivel as "baixo" | "medio" | "alto" };
}

/** Datas da suspensão: retorno e dias descontados por mês (para a pré-folha). */
export function periodoSuspensao(inicio: Date, dias: number) {
  const ini = soData(inicio);
  const porMes = new Map<string, { ano: number; mes: number; dias: number }>();
  for (let i = 0; i < dias; i++) {
    const d = new Date(ini.getTime() + i * 86_400_000);
    const chave = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    const atual = porMes.get(chave) ?? { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dias: 0 };
    atual.dias++;
    porMes.set(chave, atual);
  }
  const fim = new Date(ini.getTime() + (dias - 1) * 86_400_000);
  return { inicio: ini, fim, retorno: new Date(fim.getTime() + 86_400_000), porMes: [...porMes.values()] };
}
