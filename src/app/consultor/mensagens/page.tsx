import Link from "next/link";
import { marcarLidas } from "@/app/acoes-mensagens";
import { Conversa } from "@/components/Conversa";
import { Cartao, Selo, Titulo } from "@/components/ui";
import { exigirConsultor } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

export const metadata = { title: "Mensagens" };

export default async function Mensagens({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const u = await exigirConsultor();
  const { cliente } = await searchParams;
  const clientes = await prisma.cliente.findMany({
    where: { anonimizadoEm: null, ativo: true },
    select: { id: true, nome: true, mensagens: { orderBy: { criadoEm: "desc" }, take: 1, select: { criadoEm: true, texto: true } }, _count: { select: { mensagens: { where: { lidaEm: null, autor: { papel: "CLIENTE" } } } } } },
  });
  clientes.sort((a, b) => (b.mensagens[0]?.criadoEm.getTime() ?? 0) - (a.mensagens[0]?.criadoEm.getTime() ?? 0));
  const atual = clientes.find((c) => c.id === cliente);
  if (atual) await marcarLidas(atual.id, "CONSULTOR");
  const respostas = await prisma.respostaPronta.findMany({ orderBy: { titulo: "asc" } });
  return (
    <>
      <Titulo>Mensagens</Titulo>
      <div className="grid gap-4 lg:grid-cols-3">
        <Cartao titulo="Conversas">
          <ul className="divide-y divide-slate-100">
            {clientes.map((c) => (
              <li key={c.id}>
                <Link href={`/consultor/mensagens?cliente=${c.id}`} className={`block rounded-lg p-2 ${c.id === cliente ? "bg-marca-50" : "hover:bg-slate-50"}`}>
                  <span className="font-semibold">{c.nome}</span> {c._count.mensagens > 0 && <Selo cor="vermelho">{c._count.mensagens}</Selo>}
                  <span className="block truncate text-xs text-slate-500">{c.mensagens[0]?.texto ?? "sem mensagens"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Cartao>
        <div className="lg:col-span-2">
          {atual ? <Conversa clienteId={atual.id} usuarioId={u.id} respostas={respostas} /> : <Cartao><p className="text-slate-500">Escolha uma conversa.</p></Cartao>}
        </div>
      </div>
    </>
  );
}
