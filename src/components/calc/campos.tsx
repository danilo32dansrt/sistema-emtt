"use client";

import type { ReactNode } from "react";

export function CampoCalc({ rotulo, valor, onChange, tipo = "text", ajuda, min, max }: { rotulo: string; valor: string | number; onChange: (v: string) => void; tipo?: string; ajuda?: ReactNode; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{rotulo}</span>
      <input
        type={tipo}
        value={valor}
        min={min}
        max={max}
        inputMode={tipo === "text" ? "decimal" : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus:border-marca-500 focus:outline-none focus:ring-4 focus:ring-marca-100"
      />
      {ajuda && <span className="mt-1 block text-xs text-slate-500">{ajuda}</span>}
    </label>
  );
}

export function SelecaoCalc({ rotulo, valor, onChange, opcoes }: { rotulo: string; valor: string; onChange: (v: string) => void; opcoes: { valor: string; rotulo: string }[] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{rotulo}</span>
      <select value={valor} onChange={(e) => onChange(e.target.value)} className="block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base">
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ChecaCalc({ rotulo, valor, onChange }: { rotulo: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3">
      <input type="checkbox" checked={valor} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-marca-600" />
      <span className="text-sm">{rotulo}</span>
    </label>
  );
}

export function Resumo({ itens }: { itens: { rotulo: string; valor: ReactNode; destaque?: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {itens.map((i) => (
        <div key={i.rotulo} className={`rounded-xl p-3 ${i.destaque ? "bg-marca-600 text-white" : "bg-slate-50"}`}>
          <p className={`text-xs ${i.destaque ? "text-marca-100" : "text-slate-500"}`}>{i.rotulo}</p>
          <p className="text-lg font-bold tabular-nums">{i.valor}</p>
        </div>
      ))}
    </div>
  );
}

/** Converte texto digitado em número sem lançar erro (vazio = 0). */
export function n(v: string | number): number {
  if (typeof v === "number") return v;
  const t = v.replace(/[R$\s]/g, "");
  const x = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(x) ? x : 0;
}

/** Lê data de input type=date sem lançar erro. */
export function d(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}
