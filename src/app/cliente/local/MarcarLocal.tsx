"use client";

import { useActionState, useState } from "react";
import { RAIOS_PERMITIDOS } from "@/lib/ponto/geo";
import { salvarLocalCasa } from "./acoes";

/** Botão "Estou no meio da casa": pega o GPS do celular com alta precisão e salva como local de trabalho. */
export function MarcarLocal({ raioAtual }: { raioAtual: number }) {
  const [estado, acao, enviando] = useActionState(salvarLocalCasa, null);
  const [pos, setPos] = useState<{ latitude: number; longitude: number; precisao: number } | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const [raio, setRaio] = useState(raioAtual);

  function pegar() {
    setErro("");
    if (!("geolocation" in navigator)) return setErro("Este celular não informa a localização.");
    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ latitude: p.coords.latitude, longitude: p.coords.longitude, precisao: Math.round(p.coords.accuracy) }); setBuscando(false); },
      () => { setErro("Não foi possível pegar a localização. Permita o acesso à localização para este app e tente de novo."); setBuscando(false); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={pegar} disabled={buscando} className="min-h-14 w-full rounded-2xl bg-marca-600 px-4 text-lg font-bold text-white">
        {buscando ? "Buscando o GPS…" : "📍 Estou no meio da casa — pegar a localização"}
      </button>
      {erro && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
      {pos && (
        <form action={acao} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm">
            Localização encontrada com precisão de <b>{pos.precisao} m</b>.{" "}
            {pos.precisao > 30 ? <span className="text-amber-700">O sinal está fraco: vá para perto de uma janela e toque de novo no botão acima.</span> : <span className="text-emerald-700">Sinal bom.</span>}{" "}
            <a className="font-semibold text-marca-700 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${pos.latitude},${pos.longitude}`}>Conferir no mapa</a>
          </p>
          <input type="hidden" name="latitude" value={pos.latitude} />
          <input type="hidden" name="longitude" value={pos.longitude} />
          <label className="block text-sm font-semibold text-slate-700">
            Distância permitida a partir deste ponto
            <select name="raio" value={raio} onChange={(e) => setRaio(Number(e.target.value))} className="mt-1 block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3">
              {RAIOS_PERMITIDOS.map((r) => <option key={r} value={r}>{r} metros</option>)}
            </select>
          </label>
          <button disabled={enviando} className="min-h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white">{enviando ? "Salvando…" : "Salvar como local da casa"}</button>
          {estado?.erro && <p className="text-sm text-red-700">{estado.erro}</p>}
          {estado?.ok && <p className="text-sm text-emerald-700">{estado.mensagem}</p>}
        </form>
      )}
    </div>
  );
}
