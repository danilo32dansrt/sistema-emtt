import { Cartao, Celula, Selecao, Tabela, Titulo } from "@/components/ui";
import { prisma } from "@/lib/db";

export const metadata = { title: "Registro de atividades" };

export default async function Atividades({ searchParams }: { searchParams: Promise<{ cliente?: string; acao?: string }> }) {
  const sp = await searchParams;
  const [lista, clientes, acessos] = await Promise.all([
    prisma.atividade.findMany({ where: { ...(sp.cliente ? { clienteId: sp.cliente } : {}), ...(sp.acao ? { acao: sp.acao } : {}) }, include: { usuario: { select: { nome: true } }, cliente: { select: { nome: true } } }, orderBy: { criadoEm: "desc" }, take: 300 }),
    prisma.cliente.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.acessoLog.findMany({ orderBy: { criadoEm: "desc" }, take: 30 }),
  ]);
  return (
    <>
      <Titulo subtitulo="Histórico de tudo o que foi feito em cada cliente — protege o consultor em caso de questionamento.">Registro de atividades</Titulo>
      <Cartao className="mb-4">
        <form className="grid gap-3 sm:grid-cols-3">
          <Selecao rotulo="Cliente" name="cliente" defaultValue={sp.cliente ?? ""} opcoes={[{ valor: "", rotulo: "Todos" }, ...clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))]} />
          <Selecao rotulo="Ação" name="acao" defaultValue={sp.acao ?? ""} opcoes={[{ valor: "", rotulo: "Todas" }, ...["LOGIN", "CHECKLIST", "DAE_EMITIDO", "DOCUMENTO_GERADO", "DOCUMENTO_ASSINADO", "DOCUMENTO_ACESSADO", "ARQUIVO_ACESSADO", "LANCAMENTO", "INFORMACOES_MES", "AJUSTE_DECIDIDO", "DESLIGAMENTO", "DISCIPLINAR", "EXPORTACAO", "EXCLUSAO_LGPD"].map((a) => ({ valor: a, rotulo: a.toLowerCase().replace(/_/g, " ") }))]} />
          <button className="min-h-12 self-end rounded-xl bg-slate-800 px-5 font-semibold text-white">Filtrar</button>
        </form>
      </Cartao>
      <Cartao className="mb-4">
        <Tabela cabecalho={["Quando", "Quem", "Cliente", "O que", "IP"]}>
          {lista.map((a) => (
            <tr key={a.id}>
              <Celula className="whitespace-nowrap text-xs">{a.criadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</Celula>
              <Celula>{a.usuario?.nome ?? "sistema"}</Celula>
              <Celula>{a.cliente?.nome ?? "—"}</Celula>
              <Celula>{a.descricao}</Celula>
              <Celula className="text-xs text-slate-500">{a.ip ?? ""}</Celula>
            </tr>
          ))}
        </Tabela>
      </Cartao>
      <Cartao titulo="Tentativas de login recentes">
        <Tabela cabecalho={["Quando", "E-mail", "Resultado", "IP"]}>
          {acessos.map((a) => (
            <tr key={a.id}>
              <Celula className="text-xs">{a.criadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</Celula>
              <Celula>{a.email}</Celula>
              <Celula className={a.sucesso ? "text-emerald-700" : "text-red-700"}>{a.sucesso ? "sucesso" : `falha (${a.motivo?.replace(/_/g, " ")})`}</Celula>
              <Celula className="text-xs">{a.ip ?? ""}</Celula>
            </tr>
          ))}
        </Tabela>
      </Cartao>
    </>
  );
}
