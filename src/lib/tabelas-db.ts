import "server-only";
import { escolherTabela, TABELAS_PADRAO, type TabelaAnual } from "./calculos";
import { prisma } from "./db";
import { tabelaDoBanco } from "./conversao";

export async function todasTabelas(): Promise<TabelaAnual[]> {
  const lista = await prisma.tabelaAnual.findMany({ orderBy: { ano: "asc" } });
  if (!lista.length) return Object.values(TABELAS_PADRAO);
  return lista.map(tabelaDoBanco);
}

/** Tabela do ano (ou a mais recente anterior, com aviso). */
export async function tabelaDoAno(ano: number) {
  return escolherTabela(await todasTabelas(), ano);
}

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
