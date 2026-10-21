import { BotaoAcao } from "@/components/Formulario";
import { FormGerarDocumento } from "@/components/FormGerarDocumento";
import { ListaDocumentos } from "@/components/ListaDocumentos";
import { Cartao, Titulo } from "@/components/ui";
import { formatarData } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { TIPOS_DOCUMENTO } from "@/lib/servicos/documentos";
import { excluirDocumento } from "@/app/acoes-documentos";

export const metadata = { title: "Documentos" };

export default async function Documentos({ searchParams }: { searchParams: Promise<{ empregado?: string; cliente?: string; busca?: string }> }) {
  const sp = await searchParams;
  const [clientes, empregados, documentos] = await Promise.all([
    prisma.cliente.findMany({ where: { ativo: true, anonimizadoEm: null }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.empregado.findMany({ where: { cliente: { anonimizadoEm: null } }, select: { id: true, nome: true, clienteId: true, ferias: { orderBy: { inicioGozo: "desc" } } }, orderBy: { nome: "asc" } }),
    prisma.documento.findMany({
      where: {
        ...(sp.empregado ? { empregadoId: sp.empregado } : {}),
        ...(sp.cliente ? { clienteId: sp.cliente } : {}),
        ...(sp.busca ? { OR: [{ titulo: { contains: sp.busca, mode: "insensitive" } }, { empregado: { nome: { contains: sp.busca, mode: "insensitive" } } }, { cliente: { nome: { contains: sp.busca, mode: "insensitive" } } }] } : {}),
      },
      include: { assinaturas: true, empregado: { select: { nome: true } }, cliente: { select: { nome: true } } },
      orderBy: { criadoEm: "desc" },
      take: 200,
    }),
  ]);
  return (
    <>
      <Titulo subtitulo="Gere contratos, recibos, avisos e espelhos em PDF, preenchidos com os dados cadastrados.">Central de documentos</Titulo>
      <Cartao titulo="Gerar documento" className="mb-4">
        <FormGerarDocumento
          clientes={clientes}
          empregados={empregados.map((e) => ({ id: e.id, nome: e.nome, clienteId: e.clienteId, ferias: e.ferias.map((f) => ({ id: f.id, rotulo: `${formatarData(f.inicioGozo)} (${f.dias} dias)` })) }))}
          tipos={Object.entries(TIPOS_DOCUMENTO).map(([valor, t]) => ({ valor, rotulo: t.rotulo, empregado: t.empregado }))}
          inicial={{ empregadoId: sp.empregado, clienteId: sp.cliente }}
        />
      </Cartao>
      <Cartao titulo="Documentos">
        <form className="mb-3 flex gap-2">
          <input name="busca" defaultValue={sp.busca} placeholder="Buscar por título, cliente ou empregado" className="min-h-12 flex-1 rounded-xl border border-slate-300 px-3" />
          <button className="min-h-12 rounded-xl bg-slate-800 px-5 font-semibold text-white">Buscar</button>
        </form>
        <ListaDocumentos documentos={documentos} mostrarCliente linkDetalhe={(id) => `/consultor/documentos/${id}`} acoes={(d) => (d.assinaturas.length ? null : <BotaoAcao acao={excluirDocumento} campos={{ documentoId: d.id }} confirmar="Excluir este documento?">Excluir</BotaoAcao>)} />
      </Cartao>
    </>
  );
}
