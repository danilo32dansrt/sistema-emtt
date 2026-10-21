import "server-only";
import { cache } from "react";
import {
  data, definicao, hojeBrasil, parametrosSociais, PARAMETROS_PADRAO, tabelaNaData, tabelasPorAno, type RegistroParametro, type TabelaAnual,
} from "./calculos";
import { prisma } from "./db";

/** Todos os registros de parâmetros (com vigência). Sem nada no banco, usa os valores padrão. */
export const registrosParametros = cache(async (): Promise<RegistroParametro[]> => {
  const lista = await prisma.parametro.findMany({ orderBy: [{ chave: "asc" }, { vigenciaInicio: "asc" }] });
  const doBanco = lista.map((p) => ({ chave: p.chave, valor: p.valor, vigenciaInicio: p.vigenciaInicio }));
  // Chaves ainda não cadastradas usam o padrão (avisado na tela de parâmetros)
  const faltando = PARAMETROS_PADRAO.filter((p) => !doBanco.some((b) => b.chave === p.chave));
  return [...doBanco, ...faltando];
});

/** Tabela com os valores vigentes na data (cálculos de meses passados usam o valor da época). */
export async function tabelaNaDataDb(ref: Date): Promise<{ tabela: TabelaAnual; aproximada: boolean }> {
  const lista = await registrosParametros();
  try {
    return { tabela: tabelaNaData(lista, ref), aproximada: false };
  } catch {
    const ultima = lista.reduce((m, r) => (r.vigenciaInicio > m ? r.vigenciaInicio : m), new Date(0));
    return { tabela: { ...tabelaNaData(lista, ultima), ano: ref.getUTCFullYear() }, aproximada: true };
  }
}

/** Tabelas por ano para as calculadoras do navegador. */
export async function todasTabelas(): Promise<TabelaAnual[]> {
  return tabelasPorAno(await registrosParametros(), hojeBrasil());
}

/** Tabela do ano: hoje no ano corrente, 31/12 em anos passados e 1º/01 em anos futuros. */
export async function tabelaDoAno(ano: number) {
  const hoje = hojeBrasil();
  const ref = ano === hoje.getUTCFullYear() ? hoje : ano < hoje.getUTCFullYear() ? data(ano, 12, 31) : data(ano, 1, 1);
  return tabelaNaDataDb(ref);
}

export async function parametrosSociaisHoje() {
  return parametrosSociais(await registrosParametros(), hojeBrasil());
}

export { definicao };

export async function configuracao() {
  return (
    (await prisma.configuracao.findUnique({ where: { id: "principal" } })) ??
    (await prisma.configuracao.create({ data: { id: "principal" } }))
  );
}

export async function modelosMensagem() {
  const { MODELOS_PADRAO } = await import("./whatsapp");
  const doBanco = await prisma.modeloMensagem.findMany();
  return MODELOS_PADRAO.map((m) => doBanco.find((d) => d.chave === m.chave) ?? m).concat(doBanco.filter((d) => !MODELOS_PADRAO.some((m) => m.chave === d.chave)));
}
