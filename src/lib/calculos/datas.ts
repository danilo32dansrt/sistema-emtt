/**
 * Datas "de calendário" (sem horário). Internamente usamos Date à meia-noite UTC,
 * o que evita erros de fuso horário/horário de verão nos cálculos de dias.
 */

const DIA_MS = 86_400_000;

export function data(ano: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Normaliza qualquer Date/ISO para a meia-noite UTC do mesmo dia (do ponto de vista UTC). */
export function soData(d: Date | string): Date {
  if (typeof d === "string") return lerData(d);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Data de hoje no fuso de Brasília. */
export function hojeBrasil(agora: Date = new Date()): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  return lerData(partes);
}

/** Aceita "dd/mm/aaaa" ou "aaaa-mm-dd" (também com horário ISO). */
export function lerData(texto: string): Date {
  const t = texto.trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return validar(Number(m[3]), Number(m[2]), Number(m[1]), texto);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return validar(Number(m[1]), Number(m[2]), Number(m[3]), texto);
  throw new Error(`Data inválida: ${texto}`);
}

function validar(ano: number, mes: number, dia: number, original: string): Date {
  const d = data(ano, mes, dia);
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    throw new Error(`Data inválida: ${original}`);
  }
  return d;
}

export function formatarData(d: Date | null | undefined): string {
  if (!d) return "";
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}

/** aaaa-mm-dd (para inputs type="date"). */
export function isoData(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export const NOMES_MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function nomeMes(mes: number): string {
  return NOMES_MESES[mes - 1];
}

export function formatarCompetencia(ano: number, mes: number): string {
  return `${String(mes).padStart(2, "0")}/${ano}`;
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function addDias(d: Date, dias: number): Date {
  return new Date(d.getTime() + dias * DIA_MS);
}

/** Soma meses mantendo o dia; se o dia não existir no mês destino, usa o último dia. */
export function addMeses(d: Date, meses: number): Date {
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + meses;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return data(ano, mes, Math.min(d.getUTCDate(), diasNoMes(ano, mes)));
}

export function addAnos(d: Date, anos: number): Date {
  return addMeses(d, anos * 12);
}

/** Diferença em dias (b - a). */
export function diferencaDias(a: Date, b: Date): number {
  return Math.round((soData(b).getTime() - soData(a).getTime()) / DIA_MS);
}

/** Quantidade de dias de a até b, contando os dois extremos. */
export function diasInclusivos(a: Date, b: Date): number {
  return diferencaDias(a, b) + 1;
}

export function mesmoDia(a: Date, b: Date): boolean {
  return soData(a).getTime() === soData(b).getTime();
}

export function maxData(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

export function minData(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

export function primeiroDiaMes(ano: number, mes: number): Date {
  return data(ano, mes, 1);
}

export function ultimoDiaMes(ano: number, mes: number): Date {
  return data(ano, mes, diasNoMes(ano, mes));
}

/** Anos completos entre a e b (aniversário). */
export function anosCompletos(a: Date, b: Date): number {
  let anos = b.getUTCFullYear() - a.getUTCFullYear();
  if (addAnos(a, anos).getTime() > b.getTime()) anos -= 1;
  return Math.max(0, anos);
}

export function idade(nascimento: Date, referencia: Date): number {
  return anosCompletos(nascimento, referencia);
}

/** 0 = domingo ... 6 = sábado */
export function diaSemana(d: Date): number {
  return d.getUTCDay();
}

export const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];
export const NOMES_DIAS_SEMANA: Record<DiaSemana, string> = {
  dom: "Domingo", seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado",
};

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return data(ano, mes, dia);
}

export interface Feriado {
  data: Date;
  nome: string;
}

/** Feriados nacionais (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023 e Sexta-feira Santa). */
export function feriadosNacionais(ano: number): Feriado[] {
  const p = pascoa(ano);
  const lista: Feriado[] = [
    { data: data(ano, 1, 1), nome: "Confraternização Universal" },
    { data: addDias(p, -2), nome: "Sexta-feira Santa" },
    { data: data(ano, 4, 21), nome: "Tiradentes" },
    { data: data(ano, 5, 1), nome: "Dia do Trabalho" },
    { data: data(ano, 9, 7), nome: "Independência do Brasil" },
    { data: data(ano, 10, 12), nome: "Nossa Senhora Aparecida" },
    { data: data(ano, 11, 2), nome: "Finados" },
    { data: data(ano, 11, 15), nome: "Proclamação da República" },
    { data: data(ano, 12, 25), nome: "Natal" },
  ];
  if (ano >= 2024) lista.push({ data: data(ano, 11, 20), nome: "Dia Nacional de Zumbi e da Consciência Negra" });
  return lista.sort((a, b) => a.data.getTime() - b.data.getTime());
}

const cacheFeriados = new Map<number, Set<number>>();

export function ehFeriado(d: Date, feriadosExtras: Date[] = []): boolean {
  const ano = d.getUTCFullYear();
  let set = cacheFeriados.get(ano);
  if (!set) {
    set = new Set(feriadosNacionais(ano).map((f) => f.data.getTime()));
    cacheFeriados.set(ano, set);
  }
  const t = soData(d).getTime();
  return set.has(t) || feriadosExtras.some((f) => soData(f).getTime() === t);
}

export function ehDiaUtil(d: Date, feriadosExtras: Date[] = []): boolean {
  const ds = diaSemana(d);
  return ds !== 0 && ds !== 6 && !ehFeriado(d, feriadosExtras);
}

/** Se a data não for dia útil, volta até o dia útil anterior (regra de vencimento do DAE). */
export function diaUtilAnteriorOuIgual(d: Date, feriadosExtras: Date[] = []): Date {
  let atual = soData(d);
  while (!ehDiaUtil(atual, feriadosExtras)) atual = addDias(atual, -1);
  return atual;
}

/** Competência seguinte (mes 1-12). */
export function proximaCompetencia(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

export function competenciaAnterior(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
}

/** Lista as datas de a até b (inclusive). */
export function intervaloDatas(a: Date, b: Date): Date[] {
  const lista: Date[] = [];
  for (let d = soData(a); d.getTime() <= b.getTime(); d = addDias(d, 1)) lista.push(d);
  return lista;
}

/** Dias úteis (seg-sáb, exceto feriados) e dias de descanso (domingos + feriados) do mês — usado no reflexo do DSR. */
export function diasUteisEDescansoNoMes(ano: number, mes: number, feriadosExtras: Date[] = []) {
  let uteis = 0;
  let descanso = 0;
  for (const d of intervaloDatas(primeiroDiaMes(ano, mes), ultimoDiaMes(ano, mes))) {
    if (diaSemana(d) === 0 || ehFeriado(d, feriadosExtras)) descanso++;
    else uteis++;
  }
  return { uteis, descanso };
}

/** Converte "HH:MM" em minutos desde 00:00. */
export function horaParaMinutos(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) throw new Error(`Horário inválido: ${hhmm}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Horário inválido: ${hhmm}`);
  return h * 60 + min;
}

export function minutosParaHora(minutos: number): string {
  const sinal = minutos < 0 ? "-" : "";
  const abs = Math.round(Math.abs(minutos));
  return `${sinal}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
