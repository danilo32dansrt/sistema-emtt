"use client";

import { useEffect, useRef, useState } from "react";
import { resolverPendencia } from "@/app/acoes-pendencias";

const SEGURAR_MS = 2000;
const TRECHO_MS = 15_000;
const GRAVAR_MAX_MS = 10 * 60_000;

/** Pega a localização em até 4 s (sem esperar mais: o alerta não pode atrasar). */
function localizacao(): Promise<GeolocationCoordinates | null> {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok(null);
    const t = setTimeout(() => ok(null), 4000);
    navigator.geolocation.getCurrentPosition((p) => { clearTimeout(t); ok(p.coords); }, () => { clearTimeout(t); ok(null); }, { enableHighAccuracy: true, timeout: 4000, maximumAge: 60_000 });
  });
}

/**
 * SOS da empregada: segurar 2 segundos (soltar antes cancela, para evitar toque sem querer). Avisa na hora os
 * patrões e o consultor, envia a localização e grava o áudio em trechos de 15 s enviados ao servidor.
 */
export function BotaoSOS() {
  const [progresso, setProgresso] = useState(0);
  const [fase, setFase] = useState<"parado" | "enviando" | "ativo" | "erro">("parado");
  const [id, setId] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const [trechos, setTrechos] = useState(0);
  const [segundos, setSegundos] = useState(0);
  const [atendidaPor, setAtendidaPor] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const inicio = useRef(0);
  const quadro = useRef(0);
  const fluxo = useRef<MediaStream | null>(null);
  const parar = useRef(false);

  function soltar() {
    cancelAnimationFrame(quadro.current);
    if (fase === "parado") setProgresso(0);
  }
  function segurar() {
    if (fase !== "parado") return;
    inicio.current = performance.now();
    navigator.vibrate?.(30);
    const passo = () => {
      const p = Math.min(1, (performance.now() - inicio.current) / SEGURAR_MS);
      setProgresso(p);
      if (p >= 1) void acionar();
      else quadro.current = requestAnimationFrame(passo);
    };
    quadro.current = requestAnimationFrame(passo);
  }

  async function acionar() {
    setFase("enviando");
    navigator.vibrate?.([300, 100, 300]);
    const gravacao = iniciarGravacao(); // pede o microfone já, em paralelo
    const pos = await localizacao();
    try {
      const r = await fetch("/api/emergencia", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ latitude: pos?.latitude ?? null, longitude: pos?.longitude ?? null, precisao: pos?.accuracy ?? null }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro);
      setId(j.id);
      setFase("ativo");
      void gravacao.then((stream) => stream && gravarEmTrechos(stream, j.id));
    } catch {
      setFase("erro");
      setAviso("Sem internet: o aviso não foi enviado. Ligue agora para um dos números abaixo ou para os patrões.");
    }
  }

  async function iniciarGravacao() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      fluxo.current = s;
      return s;
    } catch {
      setAviso("O microfone não foi liberado: o aviso foi enviado, mas sem gravação.");
      return null;
    }
  }

  /** Cada trecho é um arquivo completo (para tocar sozinho); envia e começa o próximo até parar ou 10 min. */
  async function gravarEmTrechos(stream: MediaStream, emergenciaId: string) {
    setGravando(true);
    const fim = Date.now() + GRAVAR_MAX_MS;
    const tipo = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
    while (!parar.current && Date.now() < fim) {
      const blob = await new Promise<Blob>((ok) => {
        const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
        const partes: Blob[] = [];
        rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
        rec.onstop = () => ok(new Blob(partes, { type: rec.mimeType || "audio/webm" }));
        rec.start();
        const t0 = Date.now();
        const vigia = setInterval(() => { if (parar.current || Date.now() - t0 >= TRECHO_MS) { clearInterval(vigia); rec.stop(); } }, 250);
      });
      try {
        const r = await fetch(`/api/emergencia/${emergenciaId}/trecho`, { method: "POST", headers: { "content-type": blob.type }, body: blob });
        const j = await r.json();
        if (r.ok) setTrechos(j.ordem);
        if (j.atendidaPor) setAtendidaPor(j.atendidaPor);
        if (j.parar) break;
      } catch { /* sem internet: segue gravando o próximo trecho */ }
    }
    stream.getTracks().forEach((t) => t.stop());
    setGravando(false);
  }

  // Cronômetro e consulta de quem está indo
  useEffect(() => {
    if (fase !== "ativo" || !id) return;
    const t0 = Date.now();
    const relogio = setInterval(() => setSegundos(Math.floor((Date.now() - t0) / 1000)), 1000);
    const consulta = setInterval(async () => {
      const r = await fetch(`/api/emergencia/${id}/trecho`).catch(() => null);
      const j = await r?.json().catch(() => null);
      if (j?.atendidaPor) setAtendidaPor(j.atendidaPor);
      if (j?.status === "ENCERRADA") { parar.current = true; setFase("parado"); setProgresso(0); }
    }, 10_000);
    return () => { clearInterval(relogio); clearInterval(consulta); };
  }, [fase, id]);

  async function encerrar() {
    if (!id || !confirm("Encerrar o SOS? Faça isso só se a situação estiver resolvida ou se foi engano.")) return;
    parar.current = true;
    const fd = new FormData();
    fd.set("tipo", "SOS_ENCERRAR");
    fd.set("emergenciaId", id);
    await resolverPendencia({}, fd);
    setFase("parado");
    setProgresso(0);
    setId(null);
    setTrechos(0);
    setAtendidaPor(null);
    parar.current = false;
  }

  const numeros = (
    <div className="grid grid-cols-3 gap-2">
      {[["192", "SAMU"], ["193", "Bombeiros"], ["190", "Polícia"]].map(([n, r]) => (
        <a key={n} href={`tel:${n}`} className="flex min-h-16 flex-col items-center justify-center rounded-xl bg-white font-bold text-red-700"><span className="text-xl">{n}</span><span className="text-xs">{r}</span></a>
      ))}
    </div>
  );

  if (fase === "ativo" || fase === "erro" || fase === "enviando") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto bg-red-700 p-5 text-white" role="alertdialog" aria-live="assertive">
        <p className="text-3xl font-black">🚨 SOS</p>
        {fase === "enviando" && <p className="text-xl font-semibold">Enviando o pedido de ajuda…</p>}
        {fase === "ativo" && (
          <>
            <p className="text-xl font-semibold">Pedido de ajuda enviado aos patrões e à consultoria.</p>
            {atendidaPor ? <p className="rounded-xl bg-white p-3 text-lg font-bold text-emerald-700">✅ {atendidaPor.split(" ")[0]} está indo!</p> : <p className="text-lg">Aguardando resposta… o aviso se repete até alguém responder.</p>}
            <p className="text-lg">{gravando ? `🔴 Gravando o áudio — ${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")} (${trechos} trecho(s) enviado(s))` : "Gravação parada."}</p>
          </>
        )}
        {aviso && <p className="rounded-xl bg-red-900 p-3 font-semibold">{aviso}</p>}
        <p className="font-semibold">Se for grave, ligue agora:</p>
        {numeros}
        <div className="mt-auto grid gap-2">
          {gravando && <button type="button" onClick={() => { parar.current = true; }} className="min-h-12 rounded-xl border border-white/60 font-semibold">Parar a gravação</button>}
          {fase === "ativo" && <button type="button" onClick={encerrar} className="min-h-12 rounded-xl bg-white/20 font-semibold">Encerrar o SOS (resolvido ou foi engano)</button>}
          {fase === "erro" && <button type="button" onClick={() => { setFase("parado"); setProgresso(0); setAviso(""); fluxo.current?.getTracks().forEach((t) => t.stop()); }} className="min-h-12 rounded-xl bg-white/20 font-semibold">Fechar</button>}
        </div>
      </div>
    );
  }

  const graus = Math.round(progresso * 360);
  // Fixo no canto, acima do menu de baixo: sempre à mão em qualquer tela do ponto (e acima do alerta de pendências)
  return (
    <div className="nao-imprimir fixed bottom-20 right-3 z-50 flex flex-col items-center">
      {progresso > 0 && <p className="mb-1 rounded-full bg-red-700 px-3 py-1 text-xs font-bold text-white shadow">Continue segurando…</p>}
      <button
        type="button"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); segurar(); }}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onContextMenu={(e) => e.preventDefault()}
        className="flex h-[4.5rem] w-[4.5rem] touch-none select-none items-center justify-center rounded-full p-1 shadow-xl"
        style={{ background: `conic-gradient(#dc2626 ${graus}deg, #fecaca ${graus}deg)` }}
        aria-label="SOS — segure por 2 segundos para pedir ajuda"
      >
        <span className="flex h-full w-full flex-col items-center justify-center rounded-full bg-red-600 font-black leading-none text-white">
          <span className="text-xl">SOS</span>
          <span className="text-[9px] font-semibold">segure 2s</span>
        </span>
      </button>
    </div>
  );
}
