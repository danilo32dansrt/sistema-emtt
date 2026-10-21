import { addDias, diferencaDias, formatarData, horaParaMinutos } from "./datas";
import { partesLocais } from "./ponto";

/**
 * Lembretes automáticos do ponto e do DAE (regras puras, sem banco).
 * A rotina que roda a cada poucos minutos chama estas funções; a chave de cada lembrete
 * garante que ele só seja enviado uma vez.
 */

export type Destinatario = "EMPREGADO" | "EMPREGADOR";

export interface Lembrete {
  chave: string;
  para: Destinatario;
  titulo: string;
  texto: string;
  link: string;
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
  ontem?: DiaPonto;
  acordoIntervaloReduzido?: boolean;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const primeiroNome = (n: string) => n.split(" ")[0];

/** Intervalo mínimo da jornada (LC 150, art. 13; CLT, art. 71): 15 min acima de 4h, 1h (ou 30 min com acordo) acima de 6h. */
export function intervaloMinimo(previstoMinutos: number, acordoReduzido = false): number {
  if (previstoMinutos > 360) return acordoReduzido ? 30 : 60;
  if (previstoMinutos > 240) return 15;
  return 0;
}

export function lembretesPonto(e: EntradaLembretesPonto): Lembrete[] {
  const lista: Lembrete[] = [];
  const agora = partesLocais(e.agora).minutos;
  const h = e.hoje;
  const d = iso(h.data);
  const n = h.marcacoes.length;
  const ordenadas = [...h.marcacoes].sort((a, b) => a.getTime() - b.getTime());
  const desde = (m: Date) => (e.agora.getTime() - m.getTime()) / 60_000;
  const intervalo = intervaloMinimo(h.previstoMinutos, e.acordoIntervaloReduzido);
  const nome = primeiroNome(e.nome);

  if (h.diaDeTrabalho) {
    const entrada = h.entradaPrevista ? horaParaMinutos(h.entradaPrevista) : null;
    const saida = h.saidaPrevista ? horaParaMinutos(h.saidaPrevista) : null;

    // Bater a entrada
    if (n === 0 && entrada !== null && agora >= entrada - 10 && agora <= entrada + 120) {
      lista.push({ chave: `entrada:${d}`, para: "EMPREGADO", titulo: "Bom dia! Hora de bater o ponto", texto: `Seu horário começa às ${h.entradaPrevista}. Marque a entrada quando chegar.`, link: "/ponto" });
    }
    // Patrão: sem entrada meia hora depois do horário
    if (n === 0 && entrada !== null && agora >= entrada + 30 && agora <= entrada + 240) {
      lista.push({ chave: `sem-entrada:${d}`, para: "EMPREGADOR", titulo: `${nome} ainda não marcou a entrada`, texto: `O horário de hoje começava às ${h.entradaPrevista}. Se ela veio e esqueceu, combinem o ajuste; se faltou, registre no ponto.`, link: "/cliente/ponto" });
    }
    // Sair para o intervalo
    if (n === 1 && intervalo > 0 && desde(ordenadas[0]) >= Math.max(180, h.previstoMinutos / 2) && (saida === null || agora < saida - 30)) {
      lista.push({ chave: `intervalo:${d}`, para: "EMPREGADO", titulo: "Hora do intervalo", texto: `Faça o seu intervalo (mínimo de ${intervalo} min) e marque a saída para o intervalo.`, link: "/ponto" });
    }
    // Voltar do intervalo
    if (n === 2 && intervalo > 0 && desde(ordenadas[1]) >= intervalo + 10 && (saida === null || agora < saida - 15) && (saida === null || partesLocais(ordenadas[1]).minutos < saida - 30)) {
      lista.push({ chave: `retorno:${d}`, para: "EMPREGADO", titulo: "Voltou do intervalo?", texto: "Não esqueça de marcar a volta do intervalo.", link: "/ponto" });
    }
    // Marcar a saída
    const passouDaSaida = saida !== null ? agora >= saida + 15 && agora <= saida + 240 : n > 0 && desde(ordenadas[0]) >= h.previstoMinutos + intervalo + 30;
    if (n % 2 === 1 && passouDaSaida) {
      lista.push({ chave: `saida:${d}`, para: "EMPREGADO", titulo: "Já terminou o dia?", texto: `Não esqueça de marcar a saída${h.saidaPrevista ? ` (horário previsto: ${h.saidaPrevista})` : ""}.`, link: "/ponto" });
    }
  }

  // Dia anterior sem marcação ou incompleto (a partir das 7h)
  const o = e.ontem;
  if (o && o.diaDeTrabalho && agora >= 7 * 60) {
    const od = iso(o.data);
    const dia = formatarData(o.data).slice(0, 5);
    if (o.marcacoes.length === 0) {
      lista.push({ chave: `ontem-sem:${od}`, para: "EMPREGADO", titulo: `Dia ${dia} sem marcação`, texto: "Se você faltou, envie a justificativa (com atestado, se tiver). Se trabalhou e esqueceu, peça o ajuste do horário.", link: "/ponto/justificativas" });
      lista.push({ chave: `ontem-sem:${od}`, para: "EMPREGADOR", titulo: `${nome}: dia ${dia} sem marcação`, texto: "Confirme com ela o que houve: falta, folga combinada ou esquecimento. Você pode lançar o horário ou decidir abonar, compensar ou descontar.", link: "/cliente/ponto" });
    } else if (o.marcacoes.length % 2 === 1) {
      lista.push({ chave: `ontem-incompleto:${od}`, para: "EMPREGADO", titulo: `Ponto do dia ${dia} incompleto`, texto: "Ficou faltando uma marcação (entrada ou saída). Peça o ajuste informando o horário certo.", link: "/ponto/justificativas" });
      lista.push({ chave: `ontem-incompleto:${od}`, para: "EMPREGADOR", titulo: `${nome}: ponto do dia ${dia} incompleto`, texto: "Ficou faltando uma marcação. Confira com ela e corrija o horário, se precisar.", link: "/cliente/ponto" });
    }
  }
  return lista;
}

/** Lembretes do DAE para o patrão: 3 dias antes, no dia e depois do vencimento (até ser pago). */
export function lembretesDae(e: { hoje: Date; vencimento: Date; pago: boolean; competencia: string; valor?: string }): Lembrete[] {
  if (e.pago) return [];
  const dias = diferencaDias(e.hoje, e.vencimento);
  const valor = e.valor ? ` de ${e.valor}` : "";
  const base = { para: "EMPREGADOR" as const, link: "/cliente/dae" };
  if (dias === 3) return [{ ...base, chave: `dae-3:${e.competencia}`, titulo: `DAE vence em 3 dias`, texto: `O DAE${valor} (competência ${e.competencia}) vence em ${formatarData(e.vencimento)}. Pague e toque em "Já paguei".` }];
  if (dias === 0) return [{ ...base, chave: `dae-hoje:${e.competencia}`, titulo: "DAE vence hoje", texto: `Pague hoje o DAE${valor} (competência ${e.competencia}) para evitar multa e juros.` }];
  if (dias < 0 && (-dias === 1 || -dias % 7 === 0)) return [{ ...base, chave: `dae-atraso:${e.competencia}:${-dias}`, titulo: "DAE em atraso", texto: `O DAE (competência ${e.competencia}) venceu em ${formatarData(e.vencimento)}. Pague o quanto antes — a multa aumenta a cada dia. Se já pagou, toque em "Já paguei".` }];
  return [];
}

/** Data de ontem (para montar a entrada dos lembretes). */
export const diaAnterior = (d: Date) => addDias(d, -1);
