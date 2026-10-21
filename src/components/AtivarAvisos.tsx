"use client";

import { useEffect, useState } from "react";

function chaveParaBytes(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const bruto = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

type Estado = "carregando" | "sem-suporte" | "instalar-iphone" | "bloqueado" | "desligado" | "ligado" | "sem-chave";

/**
 * Botão "Ativar avisos no celular". No Android funciona direto no navegador; no iPhone só depois de
 * instalar o app na tela de início (exigência da Apple, iOS 16.4 ou mais novo).
 */
export function AtivarAvisos({ chavePublica, compacto = false }: { chavePublica: string | null; compacto?: boolean }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [erro, setErro] = useState("");

  useEffect(() => {
    (async () => {
      if (!chavePublica) return setEstado("sem-chave");
      const iphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalado = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setEstado(iphone && !instalado ? "instalar-iphone" : "sem-suporte");
      if (Notification.permission === "denied") return setEstado("bloqueado");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const insc = await reg.pushManager.getSubscription();
      setEstado(insc && Notification.permission === "granted" ? "ligado" : "desligado");
    })().catch(() => setEstado("sem-suporte"));
  }, [chavePublica]);

  async function ligar() {
    setErro("");
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") return setEstado(permissao === "denied" ? "bloqueado" : "desligado");
      const reg = await navigator.serviceWorker.ready;
      const insc = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chavePublica!) as BufferSource }));
      const r = await fetch("/api/push/inscrever", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(insc.toJSON()) });
      if (!r.ok) throw new Error(await r.text());
      setEstado("ligado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ativar.");
    }
  }

  async function desligar() {
    const reg = await navigator.serviceWorker.ready;
    const insc = await reg.pushManager.getSubscription();
    if (insc) {
      await fetch("/api/push/inscrever", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: insc.endpoint }) });
      await insc.unsubscribe();
    }
    setEstado("desligado");
  }

  if (estado === "carregando" || estado === "sem-chave") return null;
  const caixa = compacto ? "rounded-xl border border-slate-200 bg-white p-3 text-sm" : "rounded-2xl border border-marca-200 bg-marca-50 p-4 text-sm";
  if (estado === "ligado")
    return (
      <div className={caixa}>
        <p className="font-semibold text-emerald-800">🔔 Avisos no celular ligados</p>
        {!compacto && <button onClick={desligar} className="mt-2 text-xs text-slate-600 underline">Desligar neste aparelho</button>}
      </div>
    );
  return (
    <div className={caixa}>
      {estado === "desligado" && (
        <>
          <p className="font-semibold text-marca-900">Receba lembretes no celular</p>
          <p className="mt-1 text-slate-700">Hora de bater o ponto, intervalo, DAE a pagar, pedidos de ajuste — o sistema avisa para nada ser esquecido.</p>
          <button onClick={ligar} className="mt-3 min-h-12 w-full rounded-xl bg-marca-600 px-4 font-semibold text-white">🔔 Ativar avisos no celular</button>
        </>
      )}
      {estado === "instalar-iphone" && (
        <p className="text-slate-700"><b>iPhone:</b> para receber avisos, instale o app: toque em <b>Compartilhar</b> (quadrado com seta) → <b>Adicionar à Tela de Início</b>. Depois abra pelo ícone e ative os avisos aqui.</p>
      )}
      {estado === "bloqueado" && <p className="text-amber-800">Os avisos estão bloqueados neste aparelho. Libere nas configurações do navegador (Notificações) e volte aqui.</p>}
      {estado === "sem-suporte" && <p className="text-slate-600">Este navegador não recebe avisos. Use o Chrome no Android ou instale o app no iPhone (iOS 16.4+).</p>}
      {erro && <p className="mt-2 text-red-700">{erro}</p>}
    </div>
  );
}
