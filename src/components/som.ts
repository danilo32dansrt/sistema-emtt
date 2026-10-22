"use client";

/**
 * Sons dos alertas (gerados no próprio navegador, sem arquivo): sirene contínua para o SOS e um toque
 * curto para pendências. O navegador só deixa tocar depois de um toque na tela; se ainda não houve,
 * `somBloqueado()` avisa para pedir um toque.
 */

let ctx: AudioContext | null = null;
let sirene: { osc: OscillatorNode | null; troca: ReturnType<typeof setInterval> } | null = null;

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

/** Vibra o celular (Android; o iPhone não deixa sites vibrarem — lá vibra pela notificação). */
export function vibrar(padrao: number | number[]) {
  try {
    navigator.vibrate?.(padrao);
  } catch {
    /* sem vibração */
  }
}

/** "Plim" curto (duas notas) com vibração, para pendências. */
export function tocarPlim() {
  vibrar([500, 150, 500, 150, 500]);
  const c = contexto();
  if (!c) return;
  [880, 1175].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime + i * 0.18;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.42);
  });
}

/** Sirene de emergência (dois tons alternando) até `pararSirene()`. */
export function tocarSirene() {
  if (sirene) return;
  vibrar(800);
  const c = contexto();
  if (!c) {
    // Sem som disponível: ao menos vibra sem parar
    sirene = { osc: null, troca: setInterval(() => vibrar(800), 1000) };
    return;
  }
  const osc = c.createOscillator();
  const ganho = c.createGain();
  osc.type = "square";
  osc.frequency.value = 960;
  ganho.gain.value = 0.3;
  osc.connect(ganho).connect(c.destination);
  osc.start();
  let alto = true;
  const troca = setInterval(() => {
    alto = !alto;
    osc.frequency.setValueAtTime(alto ? 960 : 720, c.currentTime);
    // Vibra junto com a sirene, sem parar (800 ms vibrando a cada 1 s)
    if (alto) vibrar(800);
  }, 500);
  sirene = { osc, troca };
}

export function pararSirene() {
  if (!sirene) return;
  clearInterval(sirene.troca);
  sirene.osc?.stop();
  sirene.osc?.disconnect();
  sirene = null;
  vibrar(0);
}
