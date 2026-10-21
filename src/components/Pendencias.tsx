import Link from "next/link";
import type { Lembrete } from "@/lib/calculos";

/** Pendências com o botão que resolve (as mesmas que chegam como lembrete no celular). */
export function Pendencias({ itens, titulo = "O que fazer agora" }: { itens: (Lembrete & { urgente?: boolean })[]; titulo?: string }) {
  if (!itens.length) return null;
  return (
    <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3" aria-label={titulo}>
      <h2 className="mb-2 px-1 font-semibold text-amber-900">⚠️ {titulo}</h2>
      <ul className="space-y-2">
        {itens.map((p) => (
          <li key={p.chave} className={`rounded-xl border bg-white p-3 ${p.urgente ? "border-red-300" : "border-amber-200"}`}>
            <p className="font-semibold">{p.titulo}</p>
            <p className="text-sm text-slate-700">{p.texto}</p>
            <Link href={p.link} className={`mt-2 flex min-h-12 items-center justify-center rounded-xl px-4 font-semibold text-white ${p.urgente ? "bg-red-600" : "bg-marca-600"}`}>{p.acao}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
