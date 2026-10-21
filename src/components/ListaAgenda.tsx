import Link from "next/link";
import { formatarData, nomeMes, ROTULOS_EVENTO, type Evento } from "@/lib/calculos";
import { Selo, Vazio } from "./ui";

export function ListaAgenda({ eventos, hoje, linkEmpregado }: { eventos: Evento[]; hoje: Date; linkEmpregado?: (id: string) => string }) {
  if (!eventos.length) return <Vazio>Nenhum compromisso no período.</Vazio>;
  const grupos = new Map<string, Evento[]>();
  for (const e of eventos) {
    const k = `${nomeMes(e.data.getUTCMonth() + 1)} de ${e.data.getUTCFullYear()}`;
    grupos.set(k, [...(grupos.get(k) ?? []), e]);
  }
  return (
    <div className="space-y-5">
      {[...grupos.entries()].map(([mes, lista]) => (
        <section key={mes}>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{mes}</h3>
          <ul className="space-y-2">
            {lista.map((e) => {
              const passado = e.data < hoje;
              const conteudo = (
                <div className={`flex gap-3 rounded-xl border p-3 ${e.severidade === "critico" ? "border-red-200 bg-red-50" : e.severidade === "aviso" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"} ${passado ? "opacity-60" : ""}`}>
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-2xl font-bold leading-none">{String(e.data.getUTCDate()).padStart(2, "0")}</p>
                    <p className="text-xs text-slate-500">{formatarData(e.data).slice(3, 5)}/{e.data.getUTCFullYear() % 100}</p>
                  </div>
                  <div className="min-w-0">
                    <Selo cor={e.severidade === "critico" ? "vermelho" : e.severidade === "aviso" ? "amarelo" : "azul"}>{ROTULOS_EVENTO[e.tipo]}</Selo>
                    <p className="mt-1 font-semibold">{e.titulo}</p>
                    <p className="text-sm text-slate-600">{e.descricao}</p>
                  </div>
                </div>
              );
              return <li key={e.chave}>{e.empregadoId && linkEmpregado ? <Link href={linkEmpregado(e.empregadoId)}>{conteudo}</Link> : conteudo}</li>;
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
