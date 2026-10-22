"use client";

/**
 * Sons dos alertas (gerados no próprio navegador, sem arquivo): sirene contínua para o SOS e um toque
 * curto para pendências. O navegador só deixa tocar depois de um toque na tela; se ainda não houve,
 * `somBloqueado()` avisa para pedir um toque.
 */

let ctx: AudioContext | null = null;
let sirene: { osc: OscillatorNode; ganho: GainNode; troca: ReturnType<typeof setInterval> } | null = null;

function contexto() {
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export const somBloqueado = () => !ctx || ctx.state !== "running";

/** Destrava o som no primeiro toque na tela (exigência dos navegadores). */
export function destravarSom() {
  contexto();
}

/** "Plim" curto (duas notas) para pendências. */
export function tocarPlim() {
  const c = contexto();
  if (!c) return;
  [880, 1175].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime + i * 0.18;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.42);
  });
}

/** Sirene de emergência (dois tons alternando) até `pararSirene()`. */
export function tocarSirene() {
  const c = contexto();
  if (!c || sirene) return;
  const osc = c.createOscillator();
  const ganho = c.createGain();
  osc.type = "square";
  osc.frequency.value = 960;
  ganho.gain.value = 0.18;
  osc.connect(ganho).connect(c.destination);
  osc.start();
  let alto = true;
  const troca = setInterval(() => {
    alto = !alto;
    osc.frequency.setValueAtTime(alto ? 960 : 720, c.currentTime);
    navigator.vibrate?.(alto ? 450 : 0);
  }, 500);
  sirene = { osc, ganho, troca };
}

export function pararSirene() {
  if (!sirene) return;
  clearInterval(sirene.troca);
  sirene.osc.stop();
  sirene.osc.disconnect();
  sirene = null;
  navigator.vibrate?.(0);
}
