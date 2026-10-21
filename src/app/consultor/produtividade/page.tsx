import { Cartao, Celula, Tabela, Titulo } from "@/components/ui";
import { addDias, formatarMoeda, hojeBrasil, minutosParaHora } from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";

export const metadata = { title: "Produtividade" };

export default async function Produtividade({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const dias = Number((await searchParams).dias) || 90;
  const desde = addDias(hojeBrasil(), -dias);
  const [registros, clientes] = await Promise.all([
    prisma.registroTempo.findMany({ where: { data: { gte: desde } } }),
    prisma.cliente.findMany({ where: { anonimizadoEm: null }, select: { id: true, nome: true, mensalidade: true } }),
  ]);
  const meses = dias / 30;
  const linhas = clientes
    .map((c) => {
      const minutos = registros.filter((r) => r.clienteId === c.id).reduce((t, r) => t + r.minutos, 0);
      const receita = num(c.mensalidade) * meses;
      return { ...c, minutos, receita, porHora: minutos ? receita / (minutos / 60) : null };
    })
    .sort((a, b) => b.minutos - a.minutos);
  const tarefas = new Map<string, number>();
  for (const r of registros) tarefas.set(r.tarefa, (tarefas.get(r.tarefa) ?? 0) + r.minutos);
  return (
    <>
      <Titulo subtitulo={`Últimos ${dias} dias. Registre o tempo na página de cada cliente.`}>Produtividade</Titulo>
      <div className="grid gap-4 lg:grid-cols-3">
        <Cartao titulo="Tempo e receita por cliente" className="lg:col-span-2">
          <Tabela cabecalho={["Cliente", "Tempo", "Receita no período", "Receita por hora"]}>
            {linhas.map((l) => (
              <tr key={l.id}>
                <Celula>{l.nome}</Celula>
                <Celula className="tabular-nums">{minutosParaHora(l.minutos)}</Celula>
                <Celula className="tabular-nums">{formatarMoeda(l.receita)}</Celula>
                <Celula className={`tabular-nums ${l.porHora !== null && l.porHora < 50 ? "font-semibold text-red-700" : ""}`}>{l.porHora === null ? "—" : formatarMoeda(l.porHora)}</Celula>
              </tr>
            ))}
          </Tabela>
          <p className="mt-2 text-xs text-slate-500">Clientes com receita por hora baixa (em vermelho, abaixo de R$ 50/h) podem precisar de reajuste de preço.</p>
        </Cartao>
        <Cartao titulo="Tempo por tarefa">
          <ul className="space-y-1 text-sm">{[...tarefas.entries()].sort((a, b) => b[1] - a[1]).map(([t, m]) => <li key={t} className="flex justify-between"><span>{t}</span><span className="tabular-nums">{minutosParaHora(m)}</span></li>)}</ul>
        </Cartao>
      </div>
    </>
  );
}
