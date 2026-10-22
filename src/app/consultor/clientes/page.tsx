import Link from "next/link";
import { Cartao, Celula, LinkBotao, Selo, Tabela, Titulo } from "@/components/ui";
import { diferencaDias, formatarData, formatarMoeda, formatarTelefone, hojeBrasil, mascararCpf } from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { PLANOS } from "@/lib/inter/plus";
import { prisma } from "@/lib/db";

export const metadata = { title: "Clientes" };

export default async function ListaClientes({ searchParams }: { searchParams: Promise<{ busca?: string; inativos?: string }> }) {
  const { busca, inativos } = await searchParams;
  const hoje = hojeBrasil();
  const clientes = await prisma.cliente.findMany({
    where: {
      anonimizadoEm: null,
      ...(inativos ? {} : { ativo: true }),
      ...(busca ? { OR: [{ nome: { contains: busca, mode: "insensitive" } }, { cpf: { contains: busca.replace(/\D/g, "") || "#" } }, { empregados: { some: { nome: { contains: busca, mode: "insensitive" } } } }] } : {}),
    },
    include: { _count: { select: { empregados: { where: { situacao: { not: "DESLIGADO" } } } } } },
    orderBy: { nome: "asc" },
  });

  return (
    <>
      <Titulo acoes={<LinkBotao href="/consultor/clientes/novo">+ Novo cliente</LinkBotao>}>Clientes</Titulo>
      <Cartao>
        <form className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input name="busca" defaultValue={busca} placeholder="Buscar por nome, CPF ou empregado" className="min-h-12 flex-1 rounded-xl border border-slate-300 px-3" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="inativos" defaultChecked={!!inativos} /> Mostrar inativos</label>
          <button className="min-h-12 rounded-xl bg-slate-800 px-5 font-semibold text-white">Buscar</button>
        </form>
        <Tabela cabecalho={["Cliente", "CPF", "Telefone", "Empregados", "Mensalidade", "Procuração"]} vazio="Nenhum cliente encontrado.">
          {clientes.map((c) => {
            const dias = c.procuracaoValidade ? diferencaDias(hoje, c.procuracaoValidade) : null;
            const vencida = c.procuracaoStatus === "VENCIDA" || (dias !== null && dias < 0);
            return (
              <tr key={c.id} className="hover:bg-slate-50">
                <Celula>
                  <Link href={`/consultor/clientes/${c.id}`} className="font-semibold text-marca-700 hover:underline">{c.nome}</Link>
                  {!c.ativo && <Selo>inativo</Selo>}
                </Celula>
                <Celula className="whitespace-nowrap">{mascararCpf(c.cpf)}</Celula>
                <Celula className="whitespace-nowrap">{formatarTelefone(c.telefone)}</Celula>
                <Celula>{c._count.empregados}</Celula>
                <Celula className="whitespace-nowrap">{formatarMoeda(num(c.mensalidade))} · dia {c.diaVencimento}<span className="block text-xs font-semibold text-marca-700">Plano {PLANOS[c.plano].nome}</span></Celula>
                <Celula>
                  {vencida ? <Selo cor="vermelho">Vencida</Selo> : c.procuracaoStatus === "PENDENTE" ? <Selo cor="amarelo">Pendente</Selo> : <Selo cor={dias !== null && dias <= 30 ? "amarelo" : "verde"}>Ativa até {formatarData(c.procuracaoValidade)}</Selo>}
                </Celula>
              </tr>
            );
          })}
        </Tabela>
      </Cartao>
    </>
  );
}
