import { Formulario } from "@/components/Formulario";
import { Campo, Cartao, Selo, Titulo, Vazio } from "@/components/ui";
import { exigirCliente } from "@/lib/auth/sessao";
import { formatarCompetencia, formatarData, formatarMoeda, hojeBrasil, situacaoChecklist } from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { informarPagamentoDae } from "../acoes";

export const metadata = { title: "DAE e pagamentos" };

export default async function Dae() {
  const u = await exigirCliente();
  const hoje = hojeBrasil();
  const comps = await prisma.competencia.findMany({ where: { empregado: { clienteId: u.clienteId }, daeEmitido: true }, include: { empregado: { select: { nome: true } } }, orderBy: [{ ano: "desc" }, { mes: "desc" }], take: 24 });
  return (
    <>
      <Titulo subtitulo="O DAE vence todo dia 7 (ou no dia útil anterior). Pague pelo app do banco com o código de barras.">DAE e pagamentos</Titulo>
      {!comps.length && <Vazio>Nenhum DAE emitido ainda.</Vazio>}
      <div className="space-y-3">
        {comps.map((c) => {
          const venc = situacaoChecklist(c.ano, c.mes, {}, hoje).vencimentoDae;
          const pago = c.pagamentoConfirmado;
          return (
            <Cartao key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">DAE {formatarCompetencia(c.ano, c.mes)} — {c.empregado.nome}</p>
                  <p className="text-sm text-slate-600">Vencimento {formatarData(venc)} · {c.daeValor ? formatarMoeda(num(c.daeValor)) : "valor no PDF"}</p>
                  {c.daeCodigo && <p className="mt-1 break-all rounded-lg bg-slate-50 p-2 font-mono text-xs">{c.daeCodigo}</p>}
                </div>
                {pago ? <Selo cor="verde">pago e confirmado</Selo> : c.clienteInformouPagamentoEm ? <Selo cor="azul">pagamento informado</Selo> : venc < hoje ? <Selo cor="vermelho">vencido</Selo> : <Selo cor="amarelo">a pagar</Selo>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.daeArquivoId && <a className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 font-semibold" href={`/api/arquivos/${c.daeArquivoId}`} target="_blank">Baixar DAE</a>}
                {c.comprovanteArquivoId && <a className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 font-semibold" href={`/api/arquivos/${c.comprovanteArquivoId}`} target="_blank">Meu comprovante</a>}
              </div>
              {!pago && !c.clienteInformouPagamentoEm && (
                <details className="mt-3 rounded-xl border border-slate-200 p-3">
                  <summary className="cursor-pointer font-semibold text-emerald-700">Marcar como pago</summary>
                  <Formulario acao={informarPagamentoDae} textoBotao="Confirmar que paguei" variante="sucesso" className="mt-3">
                    <input type="hidden" name="empregadoId" value={c.empregadoId} />
                    <input type="hidden" name="ano" value={c.ano} />
                    <input type="hidden" name="mes" value={c.mes} />
                    <Campo rotulo="Comprovante (foto ou PDF)" name="comprovante" type="file" accept="image/*,application/pdf" />
                  </Formulario>
                </details>
              )}
            </Cartao>
          );
        })}
      </div>
    </>
  );
}
