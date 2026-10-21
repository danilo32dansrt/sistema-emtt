import { ListaAgenda } from "@/components/ListaAgenda";
import { Cartao, Selecao, Titulo } from "@/components/ui";
import { addDias, hojeBrasil, ROTULOS_EVENTO } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { agendaDoBanco } from "@/lib/servicos/agenda";

export const metadata = { title: "Agenda e alertas" };

export default async function Agenda({ searchParams }: { searchParams: Promise<{ dias?: string; tipo?: string; cliente?: string }> }) {
  const sp = await searchParams;
  const hoje = hojeBrasil();
  const dias = Math.min(Number(sp.dias) || 90, 730);
  const [eventos, clientes] = await Promise.all([
    agendaDoBanco({ de: addDias(hoje, -15), ate: addDias(hoje, dias), clienteId: sp.cliente || undefined, hoje }),
    prisma.cliente.findMany({ where: { ativo: true, anonimizadoEm: null }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  const filtrados = sp.tipo ? eventos.filter((e) => e.tipo === sp.tipo) : eventos;
  return (
    <>
      <Titulo subtitulo="Vencimentos e alertas automáticos gerados a partir dos cadastros." acoes={<a className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold" href="/api/agenda">📲 Adicionar ao calendário (.ics)</a>}>Agenda e alertas</Titulo>
      <Cartao className="mb-4">
        <form className="grid gap-3 sm:grid-cols-4">
          <Selecao rotulo="Período" name="dias" defaultValue={String(dias)} opcoes={[{ valor: "30", rotulo: "Próximos 30 dias" }, { valor: "90", rotulo: "Próximos 90 dias" }, { valor: "180", rotulo: "Próximos 6 meses" }, { valor: "365", rotulo: "Próximos 12 meses" }]} />
          <Selecao rotulo="Tipo" name="tipo" defaultValue={sp.tipo ?? ""} opcoes={[{ valor: "", rotulo: "Todos" }, ...Object.entries(ROTULOS_EVENTO).map(([valor, rotulo]) => ({ valor, rotulo }))]} />
          <Selecao rotulo="Cliente" name="cliente" defaultValue={sp.cliente ?? ""} opcoes={[{ valor: "", rotulo: "Todos" }, ...clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))]} />
          <button className="min-h-12 self-end rounded-xl bg-slate-800 px-5 font-semibold text-white">Filtrar</button>
        </form>
      </Cartao>
      <ListaAgenda eventos={filtrados} hoje={hoje} linkEmpregado={(id) => `/consultor/empregados/${id}`} />
    </>
  );
}
