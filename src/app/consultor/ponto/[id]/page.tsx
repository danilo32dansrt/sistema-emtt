import { notFound } from "next/navigation";
import { EspelhoEmpregado } from "@/components/EspelhoEmpregado";
import { Aviso, LinkBotao, Titulo } from "@/components/ui";
import { hojeBrasil } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { verificarCadeia } from "@/lib/ponto/registro";

export default async function PontoEmpregado({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ano?: string; mes?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const e = await prisma.empregado.findUnique({ where: { id }, include: { cliente: { select: { nome: true } } } });
  if (!e) notFound();
  const hoje = hojeBrasil();
  const ano = Number(sp.ano) || hoje.getUTCFullYear();
  const mes = Number(sp.mes) || hoje.getUTCMonth() + 1;
  const cadeia = await verificarCadeia(e.id, e.cpf);
  return (
    <>
      <Titulo
        subtitulo={e.cliente.nome}
        acoes={
          <>
            <LinkBotao variante="secundario" href={`/consultor/documentos?empregado=${id}`}>Gerar espelho em PDF</LinkBotao>
            <a className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-4 font-semibold" href={`/api/ponto/arquivo?tipo=AFD&empregado=${id}&ano=${ano}&mes=${mes}`}>AFD</a>
            <a className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-4 font-semibold" href={`/api/ponto/arquivo?tipo=AEJ&empregado=${id}&ano=${ano}&mes=${mes}`}>AEJ</a>
          </>
        }
      >
        Ponto de {e.nome}
      </Titulo>
      <div className="mb-4">
        {cadeia.integra ? <Aviso tipo="sucesso">Integridade conferida: {cadeia.total} marcação(ões) com cadeia de hash íntegra.</Aviso> : <Aviso tipo="critico">Falha de integridade na marcação NSR {cadeia.nsr}. Investigue imediatamente.</Aviso>}
      </div>
      <EspelhoEmpregado empregado={e} ano={ano} mes={mes} base={`/consultor/ponto/${id}`} podeGerarLancamento />
    </>
  );
}
