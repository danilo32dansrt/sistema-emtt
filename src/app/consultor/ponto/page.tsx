import Link from "next/link";
import { PendenciasPonto } from "@/components/PendenciasPonto";
import { Cartao, Celula, Selo, Tabela, Titulo } from "@/components/ui";
import { prisma } from "@/lib/db";

export const metadata = { title: "Ponto" };

export default async function Ponto() {
  const empregados = await prisma.empregado.findMany({
    where: { situacao: { not: "DESLIGADO" }, cliente: { ativo: true } },
    include: { cliente: { select: { nome: true } }, usuario: { select: { consentimentoLgpdEm: true, ativo: true } }, marcacoes: { orderBy: { dataHora: "desc" }, take: 1 } },
    orderBy: [{ cliente: { nome: "asc" } }, { nome: "asc" }],
  });
  return (
    <>
      <Titulo subtitulo="Aplicativo de ponto (REP-P, Portaria 671/2021): marcações inalteráveis, ajustes justificados e espelho mensal.">Ponto eletrônico</Titulo>
      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao titulo="Aguardando decisão"><PendenciasPonto /></Cartao>
        <Cartao titulo="Empregados">
          <Tabela cabecalho={["Empregado", "Ponto", "Última marcação"]}>
            {empregados.map((e) => (
              <tr key={e.id}>
                <Celula><Link className="font-semibold text-marca-700" href={`/consultor/ponto/${e.id}`}>{e.nome}</Link><span className="block text-xs text-slate-500">{e.cliente.nome}</span></Celula>
                <Celula>{e.pontoAtivo ? (e.usuario?.ativo ? <Selo cor="verde">ativo</Selo> : <Selo cor="amarelo">sem acesso</Selo>) : <Selo>manual</Selo>}</Celula>
                <Celula className="text-xs">{e.marcacoes[0]?.dataHora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) ?? "—"}</Celula>
              </tr>
            ))}
          </Tabela>
        </Cartao>
      </div>
      <p className="mt-4 text-xs text-slate-500">Para comercializar o aplicativo como REP-P é necessário registro do programa no INPI, atestado técnico e termo de responsabilidade (Portaria MTP 671/2021).</p>
    </>
  );
}
