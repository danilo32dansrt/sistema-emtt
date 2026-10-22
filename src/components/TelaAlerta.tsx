"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const CHAVE = "alerta-adiado";
const ADIAR_MS = 60 * 60_000; // "Resolver depois": volta na próxima hora (mesmo ritmo dos lembretes)
const AO_ABRIR_MS = 10 * 60_000; // tocou num botão que leva a outra tela: dá 10 min para resolver lá
const ATUALIZAR_MS = 2 * 60_000;

type Adiado = { ate: number; chaves: string[] };

function lerAdiado(): Adiado | null {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? "null");
  } catch {
    return null;
  }
}
function adiar(chaves: string[], ms: number) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ ate: Date.now() + ms, chaves }));
  } catch { /* sem armazenamento: o alerta só volta a aparecer */ }
}

/**
 * Alerta de tela cheia: enquanto houver pendência, o app abre por cima de tudo com os botões que resolvem.
 * Some sozinho quando tudo é resolvido. "Resolver depois" adia por 1 hora; pendência nova faz voltar na hora.
 * Emergência (SOS) não tem "depois".
 */
export function TelaAlerta({ chaves, urgente, total, children }: { chaves: string[]; urgente: boolean; total: number; children: ReactNode }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const assinatura = chaves.join("|");

  useEffect(() => {
    const a = lerAdiado();
    const adiado = a && Date.now() < a.ate && chaves.every((c) => a.chaves.includes(c));
    const abrir = chaves.length > 0 && !adiado;
    setAberto(abrir);
    if (abrir) navigator.vibrate?.(urgente ? [600, 200, 600, 200, 600] : [200, 100, 200]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, urgente]);

  // Confere de tempos em tempos se surgiu pendência nova (e ao voltar para o app)
  useEffect(() => {
    const t = setInterval(() => router.refresh(), urgente ? 20_000 : ATUALIZAR_MS);
    const volta = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", volta);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", volta); };
  }, [router, urgente]);

  if (!aberto) return null;
  return (
    <div
      className={`fixed inset-0 z-40 flex flex-col overflow-y-auto p-4 ${urgente ? "bg-red-700" : "bg-slate-900/80 backdrop-blur-sm"}`}
      role="alertdialog"
      aria-modal="true"
      aria-label="Pendências para resolver"
      onClickCapture={(e) => {
        // Botão que leva a outra tela: deixa resolver lá por 10 minutos
        if ((e.target as HTMLElement).closest("a")) { adiar(chaves, AO_ABRIR_MS); setAberto(false); }
      }}
    >
      <div className="mx-auto w-full max-w-md">
        <p className="mb-3 text-center text-2xl font-black text-white">{urgente ? "🚨 ATENÇÃO" : `⚠️ ${total === 1 ? "Há 1 pendência" : `Há ${total} pendências`} para resolver`}</p>
        {children}
        {!urgente && (
          <button type="button" onClick={() => { adiar(chaves, ADIAR_MS); setAberto(false); }} className="mt-2 min-h-12 w-full rounded-xl border border-white/50 font-semibold text-white">
            Resolver depois (lembro de novo em 1 hora)
          </button>
        )}
      </div>
    </div>
  );
}
