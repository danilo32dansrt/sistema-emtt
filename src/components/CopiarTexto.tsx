"use client";

import { useState } from "react";

export function CopiarTexto({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="space-y-2">
      <p className="break-all rounded-lg bg-slate-50 p-2 font-mono text-xs">{texto}</p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2500);
          } catch {
            setCopiado(false);
          }
        }}
        className="min-h-11 rounded-xl bg-marca-600 px-4 font-semibold text-white"
      >
        {copiado ? "Copiado!" : "Copiar código"}
      </button>
    </div>
  );
}
