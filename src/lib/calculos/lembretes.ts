import { diferencaDias, formatarData, horaParaMinutos } from "./datas";
import { partesLocais } from "./ponto";

/**
 * Lembretes automáticos do ponto e do DAE (regras puras, sem banco).
 * A rotina que roda a cada poucos minutos chama estas funções; a chave de cada lembrete
 * garante que ele só seja enviado uma vez.
 */

export type Destinatario = "EMPREGADO" | "EMPREGADOR" | "CONSULTOR";

export interface Lembrete {
  chave: string;
  para: Destinatario;
  titulo: string;
  texto: string;
  link: string;
  /** Texto do botão que resolve a pendência (na tela e na notificação). */
  acao: string;
}

export interface DiaPonto {
  data: Date;
  /** Há jornada prevista neste dia (não é folga, feriado, férias, afastamento nem dia já justificado). */
  diaDeTrabalho: boolean;
  previstoMinutos: number;
  entradaPrevista?: string;
  saidaPrevista?: string;
  marcacoes: Date[];
}

export interface EntradaLembretesPonto {
  agora: Date;
  nome: string;
  hoje: DiaPonto;
  /** Dias anteriores ainda não resolvidos (os mais recentes primeiro). */
  anteriores?: DiaPonto[];
  acordoIntervaloReduzido?: boolean;
  /** De quanto em quanto tempo o lembrete se repete enquanto a pendência continuar (minutos). */
  repetirMinutos?: number;
  /** Faixa de horário para lembrar pendências de dias anteriores e pedidos (não incomoda de madrugada). */
  horarioComercial?: { inicio: number; fim: number };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const primeiroNome = (n: string) => n.split(" ")[0];

/** Intervalo mínimo da jornada (LC 150, art. 13; CLT, art. 71): 15 min acima de 4h, 1h (ou 30 min com acordo) acima de 6h. */
export function intervaloMinimo(previstoMinutos: number, acordoReduzido = false): number {
  if (previstoMinutos > 360) return acordoReduzido ? 30 : 60;
  if (previstoMinutos > 240) return 15;
  return 0;
}

export const HORARIO_COMERCIAL_PADRAO = { inicio: 8 * 60, fim: 20 * 60 };

/** Janela de repetição: o mesmo lembrete volta a ser enviado a cada `repetir` minutos enquanto a pendência existir. */
function janela(agora: Date, repetir: number) {
  return Math.floor(agora.getTime() / 60_000 / repetir);
}

/**
 * Lembretes do ponto. Cada pendência (entrada, intervalo, volta, saída, dia sem marcação ou incompleto)
 * gera um aviso que se repete a cada hora (configurável) até ser resolvida por quem precisa agir.
 */
export function lembretesPonto(e: EntradaLembretesPonto): Lembrete[] {
  const lista: Lembrete[] = [];
  const repetir = e.repetirMinutos ?? 60;
  const j = janela(e.agora, repetir);
  const agora = partesLocais(e.agora).minutos;
  const comercial = e.horarioComercial ?? HORARIO_COMERCIAL_PADRAO;
  const h = e.hoje;
  const d = iso(h.data);
  const n = h.marcacoes.length;
  const ordenadas = [...h.marcacoes].sort((a, b) => a.getTime() - b.getTime());
  const desde = (m: Date) => (e.agora.getTime() - m.getTime()) / 60_000;
  const intervalo = intervaloMinimo(h.previstoMinutos, e.acordoIntervaloReduzido);
  const nome = primeiroNome(e.nome);
  const add = (tipo: string, para: Destinatario, titulo: string, texto: string, link: string, acao: string, dia = d) => lista.push({ chave: `${tipo}:${dia}:${j}`, para, titulo, texto, link, acao });

  if (h.diaDeTrabalho) {
    const entrada = h.entradaPrevista ? horaParaMinutos(h.entradaPrevista) : null;
    const saida = h.saidaPrevista ? horaParaMinutos(h.saidaPrevista) : null;
    const fimDoDia = saida ?? (entrada !== null ? entrada + h.previstoMinutos + intervalo : null);

    // Entrada ainda não lançada (do horário até o fim previsto do dia)
    if (n === 0 && entrada !== null && agora >= entrada - 10 && fimDoDia !== null && agora < fimDoDia) {
      const atrasada = agora > entrada + 15;
      add("entrada", "EMPREGADO", atrasada ? "A entrada de hoje ainda não foi lançada" : "Bom dia! Hora de bater o ponto", atrasada ? `Seu horário começou às ${h.entradaPrevista}. Marque a entrada agora; se chegou mais cedo e esqueceu, peça o ajuste com o horário certo.` : `Seu horário começa às ${h.entradaPrevista}. Marque a entrada quando chegar.`, "/ponto", "Marcar entrada agora");
      if (agora >= entrada + 30) add("sem-entrada", "EMPREGADOR", `${nome} ainda não marcou a entrada`, `O horário de hoje começava às ${h.entradaPrevista}. Se ela veio e esqueceu, combinem o ajuste; se faltou, registre no ponto.`, "/cliente/ponto", "Ver o ponto de hoje");
    }
    // Intervalo não lançado
    if (n === 1 && intervalo > 0 && desde(ordenadas[0]) >= Math.max(180, h.previstoMinutos / 2) && (saida === null || agora < saida - 30)) {
      add("intervalo", "EMPREGADO", "O intervalo ainda não foi lançado", `Faça o seu intervalo (mínimo de ${intervalo} min) e marque a saída para o intervalo.`, "/ponto", "Marcar intervalo agora");
    }
    // Volta do intervalo não lançada
    if (n === 2 && intervalo > 0 && desde(ordenadas[1]) >= intervalo + 10 && (saida === null || (agora < saida && partesLocais(ordenadas[1]).minutos < saida - 30))) {
      add("retorno", "EMPREGADO", "A volta do intervalo ainda não foi lançada", "Marque a volta do intervalo. Se voltou antes e esqueceu, peça o ajuste com o horário certo.", "/ponto", "Marcar volta agora");
    }
    // Saída não lançada (até o fim do dia; depois vira pendência do dia anterior)
    const passouDaSaida = saida !== null ? agora >= saida + 15 : n > 0 && desde(ordenadas[0]) >= h.previstoMinutos + intervalo + 30;
    if (n % 2 === 1 && passouDaSaida && agora < 24 * 60) {
      add("saida", "EMPREGADO", "A saída de hoje ainda não foi lançada", `Já terminou o dia? Marque a saída${h.saidaPrevista ? ` (horário previsto: ${h.saidaPrevista})` : ""}. Se saiu e esqueceu, peça o ajuste com o horário correto.`, "/ponto", "Marcar saída agora");
    }
  }

  // Dias anteriores ainda pendentes: lembra os dois, em horário comercial, até alguém resolver
  if (agora >= comercial.inicio && agora < comercial.fim) {
    for (const o of e.anteriores ?? []) {
      if (!o.diaDeTrabalho) continue;
      const od = iso(o.data);
      const dia = formatarData(o.data).slice(0, 5);
      if (o.marcacoes.length === 0) {
        add("dia-sem", "EMPREGADO", `Dia ${dia} sem marcação`, "Se você faltou, envie a justificativa (com atestado, se tiver). Se trabalhou e esqueceu, peça o ajuste com os horários.", "/ponto/justificativas", "Justificar ou pedir ajuste", od);
        add("dia-sem", "EMPREGADOR", `${nome}: dia ${dia} sem marcação`, "Confirme com ela o que houve: falta, folga combinada ou esquecimento. Você pode lançar o horário ou decidir abonar, compensar ou descontar.", "/cliente/ponto", "Resolver o dia", od);
      } else if (o.marcacoes.length % 2 === 1) {
        add("dia-incompleto", "EMPREGADO", `Ponto do dia ${dia} incompleto`, "Ficou faltando uma marcação (entrada ou saída). Peça o ajuste informando o horário certo.", "/ponto/justificativas", "Pedir ajuste", od);
        add("dia-incompleto", "EMPREGADOR", `${nome}: ponto do dia ${dia} incompleto`, "Ficou faltando uma marcação. Confira com ela e corrija o horário.", "/cliente/ponto", "Corrigir o dia", od);
      }
    }
  }
  return lista;
}

/** Pedidos da empregada esperando o patrão: lembra a cada hora (horário comercial) até ele responder. */
export function lembretesPedidosPendentes(e: { agora: Date; pendentes: number; repetirMinutos?: number; horarioComercial?: { inicio: number; fim: number } }): Lembrete[] {
  const agora = partesLocais(e.agora).minutos;
  const c = e.horarioComercial ?? HORARIO_COMERCIAL_PADRAO;
  if (!e.pendentes || agora < c.inicio || agora >= c.fim) return [];
  return [{ chave: `pedidos:${iso(partesLocais(e.agora).data)}:${janela(e.agora, e.repetirMinutos ?? 60)}`, para: "EMPREGADOR", titulo: `${e.pendentes} pedido(s) de ponto esperando você`, texto: "Ajustes de horário ou justificativas de falta enviados pela empregada. Responda para fechar o mês sem divergência.", link: "/cliente/ponto", acao: "Responder agora" }];
}

/** Lembretes do DAE para o patrão: 3 dias antes, no dia e depois do vencimento (até ser pago). */
export function lembretesDae(e: { hoje: Date; vencimento: Date; pago: boolean; competencia: string; valor?: string }): Lembrete[] {
  if (e.pago) return [];
  const dias = diferencaDias(e.hoje, e.vencimento);
  const valor = e.valor ? ` de ${e.valor}` : "";
  const base = { para: "EMPREGADOR" as const, link: "/cliente/dae", acao: "Pagar o DAE agora" };
  if (dias === 3) return [{ ...base, chave: `dae-3:${e.competencia}`, titulo: `DAE vence em 3 dias`, texto: `O DAE${valor} (competência ${e.competencia}) vence em ${formatarData(e.vencimento)}. Pague e toque em "Já paguei".` }];
  if (dias === 0) return [{ ...base, chave: `dae-hoje:${e.competencia}`, titulo: "DAE vence hoje", texto: `Pague hoje o DAE${valor} (competência ${e.competencia}) para evitar multa e juros.` }];
  if (dias < 0 && (-dias === 1 || -dias % 7 === 0)) return [{ ...base, chave: `dae-atraso:${e.competencia}:${-dias}`, titulo: "DAE em atraso", texto: `O DAE (competência ${e.competencia}) venceu em ${formatarData(e.vencimento)}. Pague o quanto antes — a multa aumenta a cada dia. Se já pagou, toque em "Já paguei".` }];
  return [];
}


export interface SituacaoConsultor {
  agora: Date;
  /** Dia do mês até quando o consultor emite as guias (configuração; padrão dia 4). */
  diaEmissaoGuias: number;
  vencimentoDae: Date;
  competencia: string;
  daesParaEmitir: number;
  pagamentosAConfirmar: number;
  rotinaAtrasada: number;
  pedidosPonto: number;
  mensagensNaoLidas: number;
  justaCausaParaRevisar: number;
  procuracoesVencendo: number;
  mensalidadesAtrasadas: number;
  parametrosParaConferir: number;
  repetirMinutos?: number;
  horarioComercial?: { inicio: number; fim: number };
}

/**
 * Lembretes do consultor: resumo das obrigações do dia (uma vez, às 8h) e, enquanto continuarem
 * pendentes, lembretes a cada hora das urgências (guias no prazo, DAE vencendo, dossiê de justa causa,
 * mensagens de clientes).
 */
export function lembretesConsultor(s: SituacaoConsultor): Lembrete[] {
  const local = partesLocais(s.agora);
  const agora = local.minutos;
  const c = s.horarioComercial ?? HORARIO_COMERCIAL_PADRAO;
  if (agora < c.inicio || agora >= c.fim) return [];
  const d = iso(local.data);
  const j = janela(s.agora, s.repetirMinutos ?? 60);
  const diaMes = local.data.getUTCDate();
  const diasVenc = diferencaDias(local.data, s.vencimentoDae);
  const lista: Lembrete[] = [];
  const base = { para: "CONSULTOR" as Destinatario };

  const itens = [
    s.daesParaEmitir && `${s.daesParaEmitir} DAE(s) de ${s.competencia} para emitir (prazo: dia ${s.diaEmissaoGuias})`,
    s.pagamentosAConfirmar && diasVenc <= 3 && `${s.pagamentosAConfirmar} pagamento(s) de DAE para confirmar (vence ${formatarData(s.vencimentoDae)})`,
    s.rotinaAtrasada && `${s.rotinaAtrasada} etapa(s) da rotina mensal atrasada(s)`,
    s.justaCausaParaRevisar && `${s.justaCausaParaRevisar} dossiê(s) de justa causa para revisar`,
    s.pedidosPonto && `${s.pedidosPonto} pedido(s) de ponto aguardando os empregadores`,
    s.mensagensNaoLidas && `${s.mensagensNaoLidas} mensagem(ns) de clientes sem resposta`,
    s.procuracoesVencendo && `${s.procuracoesVencendo} procuração(ões) vencendo ou vencida(s)`,
    s.mensalidadesAtrasadas && `${s.mensalidadesAtrasadas} mensalidade(s) em atraso`,
    s.parametrosParaConferir && `${s.parametrosParaConferir} parâmetro(s) legal(is) para conferir`,
  ].filter(Boolean) as string[];
  if (itens.length) lista.push({ ...base, chave: `resumo:${d}`, titulo: `Hoje: ${itens.length} obrigação(ões) em aberto`, texto: itens.join(" · "), link: "/consultor", acao: "Abrir o painel" });

  // Urgências: repetem a cada hora enquanto pendentes
  if (s.daesParaEmitir && diaMes >= s.diaEmissaoGuias - 1 && diasVenc >= 0) {
    lista.push({ ...base, chave: `emitir:${d}:${j}`, titulo: diaMes > s.diaEmissaoGuias ? "Guias do DAE atrasadas" : `Emitir as guias do DAE${diaMes === s.diaEmissaoGuias ? " hoje" : " até amanhã"}`, texto: `${s.daesParaEmitir} DAE(s) de ${s.competencia} ainda não emitido(s). O DAE vence em ${formatarData(s.vencimentoDae)}.`, link: "/consultor/rotina", acao: "Emitir agora" });
  }
  if (s.pagamentosAConfirmar && diasVenc <= 0) {
    lista.push({ ...base, chave: `confirmar:${d}:${j}`, titulo: diasVenc === 0 ? "DAE vence hoje" : "DAE vencido sem pagamento confirmado", texto: `${s.pagamentosAConfirmar} DAE(s) de ${s.competencia} sem pagamento confirmado. Confira com os clientes.`, link: "/consultor/rotina", acao: "Conferir pagamentos" });
  }
  if (s.justaCausaParaRevisar) lista.push({ ...base, chave: `justa-causa:${d}:${j}`, titulo: "Dossiê de justa causa esperando você", texto: "O empregador não pode finalizar sem a sua revisão. Analise o quanto antes (imediatidade).", link: "/consultor/disciplinar", acao: "Revisar agora" });
  if (s.mensagensNaoLidas) lista.push({ ...base, chave: `mensagens:${d}:${j}`, titulo: `${s.mensagensNaoLidas} mensagem(ns) de clientes`, texto: "Há clientes esperando resposta no chat.", link: "/consultor/mensagens", acao: "Responder" });
  return lista;
}
