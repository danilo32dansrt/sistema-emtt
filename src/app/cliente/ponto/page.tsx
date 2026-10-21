import { EspelhoEmpregado } from "@/components/EspelhoEmpregado";
import { PendenciasPonto } from "@/components/PendenciasPonto";
import { Cartao, Selecao, Titulo, Vazio } from "@/components/ui";
import { exigirCliente } from "@/lib/auth/sessao";
import { hojeBrasil } from "@/lib/calculos";
import { prisma } from "@/lib/db";

export const metadata = { title: "Ponto" };

export default async function PontoCliente({ searchParams }: { searchParams: Promise<{ empregado?: string; ano?: string; mes?: string }> }) {
  const u = await exigirCliente();
  const sp = await searchParams;
  const hoje = hojeBrasil();
  const empregados = await prisma.empregado.findMany({ where: { clienteId: u.clienteId, situacao: { not: "DESLIGADO" } }, orderBy: { nome: "asc" } });
  const e = empregados.find((x) => x.id === sp.empregado) ?? empregados[0];
  return (
    <>
      <Titulo subtitulo="Aprove ou recuse os pedidos. As marcações nunca são apagadas.">Ponto dos empregados</Titulo>
      <Cartao titulo="Aguardando sua decisão" className="mb-4"><PendenciasPonto clienteId={u.clienteId} /></Cartao>
      {!e ? <Vazio>Nenhum empregado ativo.</Vazio> : (
        <>
          {empregados.length > 1 && (
            <form className="mb-4 flex items-end gap-2">
              <Selecao rotulo="Empregado" name="empregado" defaultValue={e.id} opcoes={empregados.map((x) => ({ valor: x.id, rotulo: x.nome }))} className="flex-1" />
              <button className="min-h-12 rounded-xl bg-slate-800 px-5 font-semibold text-white">Ver</button>
            </form>
          )}
          <EspelhoEmpregado empregado={e} ano={Number(sp.ano) || hoje.getUTCFullYear()} mes={Number(sp.mes) || hoje.getUTCMonth() + 1} base={`/cliente/ponto`} podeGerarLancamento />
          <p className="mt-3 text-sm text-slate-600">
            Arquivos fiscais do mês: <a className="font-semibold text-marca-700" href={`/api/ponto/arquivo?tipo=AFD&empregado=${e.id}&ano=${Number(sp.ano) || hoje.getUTCFullYear()}&mes=${Number(sp.mes) || hoje.getUTCMonth() + 1}`}>AFD</a> · <a className="font-semibold text-marca-700" href={`/api/ponto/arquivo?tipo=AEJ&empregado=${e.id}&ano=${Number(sp.ano) || hoje.getUTCFullYear()}&mes=${Number(sp.mes) || hoje.getUTCMonth() + 1}`}>AEJ</a>
          </p>
        </>
      )}
    </>
  );
}
