"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Tipo = "ENTRADA" | "SAIDA_INTERVALO" | "RETORNO_INTERVALO" | "SAIDA";

const ROTULOS: Record<Tipo, string> = {
  ENTRADA: "Entrada",
  SAIDA_INTERVALO: "Saída para intervalo",
  RETORNO_INTERVALO: "Retorno do intervalo",
  SAIDA: "Saída",
};
const ORDEM: Tipo[] = ["ENTRADA", "SAIDA_INTERVALO", "RETORNO_INTERVALO", "SAIDA"];

interface Pendente {
  tipo: Tipo;
  dataHora: string;
  idLocal: string;
  latitude: number | null;
  longitude: number | null;
  precisao: number | null;
  selfie: string | null;
}

interface Comprovante {
  nsr: number;
  tipo: string;
  dataHora: string;
  recebidoEm: string;
  hash: string;
  empregado: string;
}

const CHAVE_FILA = "ponto:fila";
const CHAVE_COMPROVANTES = "ponto:comprovantes";

function ler<T>(chave: string, padrao: T): T {
  try {
    return JSON.parse(localStorage.getItem(chave) ?? "") as T;
  } catch {
    return padrao;
  }
}
function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* armazenamento indisponível */
  }
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

async function reduzirFoto(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = erro;
      i.src = url;
    });
    const escala = Math.min(1, 480 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function localizacao(): Promise<GeolocationPosition | null> {
  return new Promise((ok) => {
    if (!("geolocation" in navigator)) return ok(null);
    navigator.geolocation.getCurrentPosition(ok, () => ok(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
  });
}

export function RelogioPonto({ marcacoesHoje, exigirSelfie, exigirLocalizacao, nome }: { marcacoesHoje: { tipo: Tipo; dataHora: string }[]; exigirSelfie: boolean; exigirLocalizacao: boolean; nome: string }) {
  const [agora, setAgora] = useState<Date | null>(null);
  const [fila, setFila] = useState<Pendente[]>([]);
  const [online, setOnline] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro" | "aviso"; texto: string } | null>(null);
  const [comprovante, setComprovante] = useState<Comprovante | null>(null);
  // Marcação barrada por estar fora da casa (GPS): ela pode confirmar que está na casa e registrar assim mesmo
  const [foraDaCasa, setForaDaCasa] = useState<Pendente | null>(null);
  const [registradasAgora, setRegistradasAgora] = useState<{ tipo: Tipo; dataHora: string }[]>([]);
  const inputFoto = useRef<HTMLInputElement>(null);
  const tipoEscolhido = useRef<Tipo>("ENTRADA");

  const sincronizar = useCallback(async () => {
    const pendentes = ler<Pendente[]>(CHAVE_FILA, []);
    if (!pendentes.length || !navigator.onLine) return;
    for (const p of pendentes) {
      try {
        const resp = await fetch("/api/ponto/marcar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...p, origem: "OFFLINE" }) });
        const json = await resp.json().catch(() => ({}));
        if (resp.ok || resp.status === 422 || resp.status === 400) {
          const restante = ler<Pendente[]>(CHAVE_FILA, []).filter((x) => x.idLocal !== p.idLocal);
          gravar(CHAVE_FILA, restante);
          if (resp.ok) gravar(CHAVE_COMPROVANTES, [json.comprovante, ...ler<Comprovante[]>(CHAVE_COMPROVANTES, [])].slice(0, 50));
          else setMensagem({ tipo: "erro", texto: `Marcação offline de ${dataHora(p.dataHora)} recusada: ${json.erro}` });
        } else if (resp.status === 401) {
          setMensagem({ tipo: "aviso", texto: "Entre novamente para enviar as marcações guardadas." });
          break;
        }
      } catch {
        break;
      }
    }
    setFila(ler<Pendente[]>(CHAVE_FILA, []));
  }, []);

  useEffect(() => {
    setAgora(new Date());
    const t = setInterval(() => setAgora(new Date()), 1000);
    setFila(ler<Pendente[]>(CHAVE_FILA, []));
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      sincronizar();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    sincronizar();
    return () => {
      clearInterval(t);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [sincronizar]);

  const hojeLocal = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const todas = [...marcacoesHoje, ...registradasAgora, ...fila.filter((f) => new Date(f.dataHora).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) === hojeLocal)]
    .filter((m, i, arr) => arr.findIndex((x) => x.dataHora === m.dataHora) === i)
    .sort((a, b) => a.dataHora.localeCompare(b.dataHora));
  const ultimo = todas.at(-1)?.tipo;
  const proximo: Tipo = !ultimo || ultimo === "SAIDA" ? "ENTRADA" : ORDEM[ORDEM.indexOf(ultimo) + 1];

  async function marcar(tipo: Tipo, selfie: string | null, confirmada?: Pendente) {
    setOcupado(true);
    setMensagem(null);
    setComprovante(null);
    setForaDaCasa(null);
    try {
      const instante = confirmada?.dataHora ?? new Date().toISOString();
      const pos = confirmada || !exigirLocalizacao ? null : await localizacao();
      const p: Pendente = confirmada ?? {
        tipo,
        dataHora: instante,
        idLocal: crypto.randomUUID(),
        latitude: pos?.coords.latitude ?? null,
        longitude: pos?.coords.longitude ?? null,
        precisao: pos?.coords.accuracy ?? null,
        selfie,
      };
      gravar(CHAVE_FILA, [...ler<Pendente[]>(CHAVE_FILA, []), p]);
      setRegistradasAgora((r) => [...r, { tipo, dataHora: instante }]);
      try {
        const resp = await fetch("/api/ponto/marcar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...p, origem: "ONLINE", registrarForaDoLocal: Boolean(confirmada) }) });
        const json = await resp.json();
        if (!resp.ok) {
          if (resp.status >= 500) throw new Error("servidor");
          gravar(CHAVE_FILA, ler<Pendente[]>(CHAVE_FILA, []).filter((x) => x.idLocal !== p.idLocal));
          setRegistradasAgora((r) => r.filter((x) => x.dataHora !== instante));
          setMensagem({ tipo: "erro", texto: json.erro ?? "Não foi possível registrar." });
          if (json.foraDoLocal) setForaDaCasa(p);
        } else {
          gravar(CHAVE_FILA, ler<Pendente[]>(CHAVE_FILA, []).filter((x) => x.idLocal !== p.idLocal));
          gravar(CHAVE_COMPROVANTES, [json.comprovante, ...ler<Comprovante[]>(CHAVE_COMPROVANTES, [])].slice(0, 50));
          setComprovante(json.comprovante);
          setMensagem({ tipo: "ok", texto: `${ROTULOS[tipo]} registrada às ${hora(instante)}.${confirmada ? " Ficou registrada como fora da casa e o patrão foi avisado." : pos || !exigirLocalizacao ? "" : " (Localização não autorizada.)"}` });
        }
      } catch {
        setMensagem({ tipo: "aviso", texto: `Sem internet: ${ROTULOS[tipo].toLowerCase()} guardada no celular às ${hora(instante)}. Será enviada automaticamente com o horário real.` });
      }
      setFila(ler<Pendente[]>(CHAVE_FILA, []));
    } finally {
      setOcupado(false);
    }
  }

  function iniciar(tipo: Tipo) {
    tipoEscolhido.current = tipo;
    if (exigirSelfie) inputFoto.current?.click();
    else marcar(tipo, null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-marca-700 p-6 text-center text-white shadow-lg">
        <p className="text-sm text-marca-100">Olá, {nome.split(" ")[0]}!</p>
        <p className="text-5xl font-bold tabular-nums" suppressHydrationWarning>
          {agora ? agora.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "--:--:--"}
        </p>
        <p className="text-sm text-marca-100" suppressHydrationWarning>
          {agora ? agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long" }) : ""}
        </p>
        {!online && <p className="mt-2 rounded-lg bg-amber-400 px-2 py-1 text-sm font-semibold text-amber-950">Sem internet — as marcações ficam guardadas no celular</p>}
      </div>

      <input
        ref={inputFoto}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            await marcar(tipoEscolhido.current, await reduzirFoto(f));
          } catch {
            setMensagem({ tipo: "erro", texto: "Não foi possível ler a foto. Tente de novo." });
          }
        }}
      />

      <button disabled={ocupado} onClick={() => iniciar(proximo)} className="flex min-h-24 w-full flex-col items-center justify-center rounded-3xl bg-emerald-600 text-2xl font-bold text-white shadow-lg active:scale-[0.99] disabled:bg-slate-400">
        {ocupado ? "Registrando..." : `Marcar ${ROTULOS[proximo].toLowerCase()}`}
        {exigirSelfie && !ocupado && <span className="text-sm font-normal">📷 com selfie</span>}
        {!exigirSelfie && exigirLocalizacao && !ocupado && <span className="text-sm font-normal">📍 pelo GPS da casa</span>}
      </button>
      <details className="rounded-2xl border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Marcar outro tipo</summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {ORDEM.filter((t) => t !== proximo).map((t) => (
            <button key={t} disabled={ocupado} onClick={() => iniciar(t)} className="min-h-12 rounded-xl border border-slate-300 text-sm font-semibold">
              {ROTULOS[t]}
            </button>
          ))}
        </div>
      </details>

      {mensagem && (
        <div role="status" className={`rounded-2xl border p-4 ${mensagem.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : mensagem.tipo === "erro" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {mensagem.texto}
          {foraDaCasa && (
            <button type="button" disabled={ocupado} onClick={() => marcar(foraDaCasa.tipo, foraDaCasa.selfie, foraDaCasa)} className="mt-3 block min-h-12 w-full rounded-xl border border-red-300 bg-white px-4 font-semibold text-red-800">
              Estou na casa — registrar mesmo assim
            </button>
          )}
          {foraDaCasa && <span className="mt-2 block text-xs">O patrão será avisado de que a marcação foi feita fora do local cadastrado.</span>}
        </div>
      )}

      {comprovante && (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-4 text-sm">
          <p className="font-bold">Comprovante de registro de ponto</p>
          <p>{comprovante.empregado}</p>
          <p>{comprovante.tipo}: <strong>{dataHora(comprovante.dataHora)}</strong></p>
          <p>NSR: {String(comprovante.nsr).padStart(9, "0")}</p>
          <p className="break-all text-xs text-slate-500">Código de autenticidade: {comprovante.hash}</p>
        </div>
      )}

      {fila.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{fila.length} marcação(ões) aguardando internet</p>
          <ul>{fila.map((f) => <li key={f.idLocal}>{ROTULOS[f.tipo]} — {dataHora(f.dataHora)}</li>)}</ul>
          <button onClick={sincronizar} className="mt-2 min-h-10 rounded-xl bg-amber-600 px-4 font-semibold text-white">Enviar agora</button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-2 font-semibold">Marcações de hoje</p>
        {todas.length === 0 ? <p className="text-sm text-slate-500">Nenhuma marcação ainda.</p> : (
          <ul className="space-y-1">
            {todas.map((m) => (
              <li key={m.dataHora} className="flex justify-between text-sm">
                <span>{ROTULOS[m.tipo]}</span>
                <span className="font-semibold tabular-nums">{hora(m.dataHora)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
