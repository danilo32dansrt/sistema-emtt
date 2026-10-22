import Link from "next/link";
import { resolverPendencia } from "@/app/acoes-pendencias";
import type { PendenciaComAcoes } from "@/lib/servicos/lembretes";
import { Formulario } from "./Formulario";
import { Campo } from "./ui";

const corLink = { primario: "bg-marca-600 text-white", sucesso: "bg-emerald-600 text-white", perigo: "bg-red-600 text-white", secundario: "border border-slate-300 bg-white text-slate-800" } as const;

/**
 * Pendências com os botões que resolvem cada uma num toque (as mesmas que chegam como lembrete no celular).
 * Sem tabelas para preencher: o patrão ou a empregada escolhe a situação e o sistema faz o lançamento.
 */
export function Pendencias({ itens, titulo = "O que fazer agora" }: { itens: PendenciaComAcoes[]; titulo?: string }) {
  if (!itens.length) return null;
  return (
    <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3" aria-label={titulo}>
      <h2 className="mb-2 px-1 font-semibold text-amber-900">⚠️ {titulo} <span className="text-sm font-normal">({itens.length})</span></h2>
      <ul className="space-y-2">
        {itens.map((p) => (
          <li key={p.chave} className={`rounded-xl border bg-white p-3 ${p.urgente ? "border-red-300" : "border-amber-200"}`}>
            <p className="font-semibold">{p.titulo}</p>
            <p className="text-sm text-slate-700">{p.texto}</p>
            {p.opcoes?.length ? (
              <div className="mt-2 grid gap-2">
                {p.opcoes.map((o) =>
                  o.tipo === "LINK" ? (
                    <Link key={o.rotulo} href={o.link!} className={`flex min-h-12 items-center justify-center rounded-xl px-4 text-center font-semibold ${corLink[o.estilo ?? "secundario"]}`}>{o.rotulo}</Link>
                  ) : (
                    <Formulario key={o.rotulo} acao={resolverPendencia} textoBotao={o.rotulo} variante={o.estilo ?? "primario"} confirmar={o.confirmar} className="space-y-2">
                      <input type="hidden" name="tipo" value={o.tipo} />
                      {Object.entries(o.dados ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                      {o.campo && <Campo id={`${o.campo.nome}-${p.chave.replace(/[^\w-]/g, "")}`} rotulo={o.campo.rotulo} name={o.campo.nome} inputMode="decimal" placeholder="0,00 (deixe vazio se não houve)" />}
                    </Formulario>
                  ),
                )}
                <Link href={p.link} className="text-center text-sm font-semibold text-marca-700 underline">{p.acao}</Link>
              </div>
            ) : (
              <Link href={p.link} className={`mt-2 flex min-h-12 items-center justify-center rounded-xl px-4 font-semibold text-white ${p.urgente ? "bg-red-600" : "bg-marca-600"}`}>{p.acao}</Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
