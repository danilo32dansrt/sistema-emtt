import Link from "next/link";
import { Cartao, Selo, Titulo } from "@/components/ui";
import { prisma } from "@/lib/db";
import { diagnosticoDoCliente } from "@/lib/servicos/diagnostico";

export const metadata = { title: "Diagnóstico de riscos" };

export default async function Diagnostico({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams;
  const clientes = await prisma.cliente.findMany({ where: { ativo: true, anonimizadoEm: null, ...(cliente ? { id: cliente } : {}) }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const resultados = await Promise.all(clientes.map(async (c) => ({ c, d: await diagnosticoDoCliente(c.id) })));
  resultados.sort((a, b) => a.d.nota - b.d.nota);
  return (
    <>
      <Titulo subtitulo="Verificação automática de pendências: folha, DAE, férias, ponto, salário, jornada e acordos escritos.">Diagnóstico de riscos trabalhistas</Titulo>
      <div className="space-y-4">
        {resultados.map(({ c, d }) => (
          <Cartao key={c.id} titulo={<Link className="text-marca-700" href={`/consultor/clientes/${c.id}`}>{c.nome}</Link>} acoes={<span className={`text-3xl font-bold ${d.nota >= 90 ? "text-emerald-700" : d.nota >= 70 ? "text-marca-700" : d.nota >= 50 ? "text-amber-700" : "text-red-700"}`}>{d.nota}<span className="text-sm text-slate-500">/100 {d.classificacao}</span></span>}>
            {d.itens.length === 0 ? <p className="text-emerald-700">Nenhum risco encontrado.</p> : (
              <ul className="divide-y divide-slate-100">
                {d.itens.map((i, n) => (
                  <li key={n} className="py-2">
                    <Selo cor={i.gravidade === "alta" ? "vermelho" : i.gravidade === "media" ? "amarelo" : "cinza"}>{i.gravidade} (−{i.peso})</Selo> <span className="font-medium">{i.mensagem}</span>
                    <span className="block text-sm text-slate-600">Como corrigir: {i.comoCorrigir}</span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        ))}
      </div>
    </>
  );
}
