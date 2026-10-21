import { ListaDocumentos } from "@/components/ListaDocumentos";
import { Cartao, Titulo } from "@/components/ui";
import { exigirCliente } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

export const metadata = { title: "Documentos" };

export default async function Documentos({ searchParams }: { searchParams: Promise<{ busca?: string }> }) {
  const u = await exigirCliente();
  const { busca } = await searchParams;
  const docs = await prisma.documento.findMany({
    where: { clienteId: u.clienteId, visivelCliente: true, ...(busca ? { OR: [{ titulo: { contains: busca, mode: "insensitive" } }, { empregado: { nome: { contains: busca, mode: "insensitive" } } }] } : {}) },
    include: { assinaturas: true, empregado: { select: { nome: true } } },
    orderBy: { criadoEm: "desc" },
  });
  return (
    <>
      <Titulo subtitulo="Contratos, recibos, DAEs, espelhos de ponto e avisos.">Documentos</Titulo>
      <Cartao>
        <form className="mb-3 flex gap-2">
          <input name="busca" defaultValue={busca} placeholder="Buscar documento" className="min-h-12 flex-1 rounded-xl border border-slate-300 px-3" />
          <button className="min-h-12 rounded-xl bg-slate-800 px-5 font-semibold text-white">Buscar</button>
        </form>
        <ListaDocumentos documentos={docs} linkDetalhe={(id) => `/cliente/documentos/${id}`} />
      </Cartao>
    </>
  );
}
