"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as EventoPonteiro } from "react";
import { salvarPosicaoCarimbo } from "@/app/acoes-documentos";
import { CARIMBO, enderecoVerificacao, ESTILO_LINHAS, limitarPosicao, linhasCarimbo, type PosicaoCarimbo, type TamanhoPagina } from "@/lib/assinatura/carimbo";
import { matrizQr } from "@/lib/assinatura/qr";
import { Aviso, Botao } from "../ui";

export interface CarimboTela {
  usuarioId: string;
  nome: string;
  /** Data da assinatura em ISO; sem data, é a prévia de quem ainda vai assinar. */
  data: string | null;
  pos: PosicaoCarimbo;
  /** false = sem linha de assinatura no documento: por enquanto vai para a página de registro. */
  temLugar: boolean;
  podeMover: boolean;
}

const ESPACO = 12;

/** Prévia do carimbo, no mesmo desenho do PDF (escala = pixels por ponto de PDF). */
export function CarimboPrevia({ nome, data, codigo, endereco, escala }: { nome: string; data: string | null; codigo: string; endereco?: string; escala: number }) {
  const dados = { nome, data: data ? new Date(data) : null, codigo, endereco };
  const linhas = linhasCarimbo(dados);
  const qr = useMemo(() => matrizQr(enderecoVerificacao(dados)), [codigo, endereco]); // eslint-disable-line react-hooks/exhaustive-deps
  const caminho = qr.flatMap((l, y) => l.map((p, x) => (p ? `M${x} ${y}h1v1h-1z` : ""))).join("");
  return (
    <div className="flex h-full w-full items-center bg-white/90 text-neutral-900" style={{ gap: 4 * escala, fontFamily: "'Times New Roman', Times, serif" }}>
      <svg viewBox={`0 0 ${qr.length} ${qr.length}`} shapeRendering="crispEdges" className="shrink-0" style={{ width: CARIMBO.altura * escala, height: CARIMBO.altura * escala }} aria-hidden>
        <path d={caminho} fill="currentColor" />
      </svg>
      <span className="min-w-0 flex-1">
        {linhas.map((l, i) => (
          <span key={i} className="block overflow-hidden whitespace-nowrap" style={{ fontSize: ESTILO_LINHAS[i].tamanho * escala, fontWeight: ESTILO_LINHAS[i].negrito ? 700 : 400, lineHeight: 1.08, marginBottom: ESTILO_LINHAS[i].depois * escala }}>
            {l}
          </span>
        ))}
      </span>
    </div>
  );
}

/**
 * Mostra as páginas do PDF e os carimbos de assinatura por cima. Quem pode, arrasta o seu carimbo (dedo ou mouse)
 * para qualquer lugar de qualquer página; ao soltar, a posição é salva. Igual ao assinador do gov.br.
 */
export function PosicionarCarimbos({ documentoId, urlPdf, paginas, carimbos: iniciais, codigo, endereco }: { documentoId: string; urlPdf: string; paginas: TamanhoPagina[]; carimbos: CarimboTela[]; codigo: string; endereco?: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const telas = useRef<(HTMLCanvasElement | null)[]>([]);
  const [largura, setLargura] = useState(0);
  const [carimbos, setCarimbos] = useState(iniciais);
  const [msg, setMsg] = useState<{ tipo: "sucesso" | "critico"; texto: string } | null>(null);
  const [erroPdf, setErroPdf] = useState(false);
  const arrasto = useRef<{ id: string; dx: number; dy: number } | null>(null);

  useEffect(() => setCarimbos(iniciais), [iniciais]);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLargura(Math.floor(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Desenha as páginas do PDF (sem os carimbos) com o pdf.js.
  useEffect(() => {
    if (!largura) return;
    let cancelado = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const pdf = await pdfjs.getDocument({ url: urlPdf, withCredentials: true }).promise;
        for (let i = 0; i < pdf.numPages && !cancelado; i++) {
          const pagina = await pdf.getPage(i + 1);
          const tela = telas.current[i];
          if (!tela) continue;
          const v1 = pagina.getViewport({ scale: 1 });
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const vp = pagina.getViewport({ scale: (largura / v1.width) * dpr });
          tela.width = Math.floor(vp.width);
          tela.height = Math.floor(vp.height);
          await pagina.render({ canvasContext: tela.getContext("2d")!, viewport: vp }).promise;
        }
      } catch {
        if (!cancelado) setErroPdf(true);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [urlPdf, largura]);

  // Altura e topo de cada página na coluna (páginas empilhadas com ESPACO entre elas).
  const alturas = paginas.map((p) => (largura * p.altura) / p.largura);
  const topos = alturas.map((_, i) => alturas.slice(0, i).reduce((s, h) => s + h + ESPACO, 0));

  const paraTela = (p: PosicaoCarimbo) => ({ left: p.x * largura, top: topos[p.pagina] + p.y * alturas[p.pagina] });

  const posicaoNoPonto = useCallback(
    (clienteX: number, clienteY: number, dx: number, dy: number): PosicaoCarimbo | null => {
      const el = caixa.current;
      if (!el || !largura) return null;
      const r = el.getBoundingClientRect();
      const top = clienteY - r.top - dy;
      const centro = top + ((CARIMBO.altura / paginas[0].altura) * alturas[0]) / 2;
      let pagina = topos.findIndex((t, i) => centro >= t - ESPACO / 2 && centro < t + alturas[i] + ESPACO / 2);
      if (pagina < 0) pagina = centro < 0 ? 0 : paginas.length - 1;
      return limitarPosicao({ pagina, x: (clienteX - r.left - dx) / largura, y: (top - topos[pagina]) / alturas[pagina] }, paginas);
    },
    [largura, paginas, alturas, topos],
  );

  const salvar = async (c: CarimboTela, extra: { padrao?: boolean } = {}) => {
    const r = await salvarPosicaoCarimbo({ documentoId, usuarioId: c.usuarioId, ...(extra.padrao ? { padrao: true } : c.pos) });
    setMsg(r?.erro ? { tipo: "critico", texto: r.erro } : { tipo: "sucesso", texto: r?.mensagem ?? "Salvo." });
    return !r?.erro;
  };

  const inicio = (e: EventoPonteiro<HTMLDivElement>, c: CarimboTela) => {
    if (!c.podeMover) return;
    const r = e.currentTarget.getBoundingClientRect();
    arrasto.current = { id: c.usuarioId, dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const mover = (e: EventoPonteiro<HTMLDivElement>) => {
    const a = arrasto.current;
    if (!a) return;
    const p = posicaoNoPonto(e.clientX, e.clientY, a.dx, a.dy);
    if (p) setCarimbos((l) => l.map((c) => (c.usuarioId === a.id ? { ...c, pos: p, temLugar: true } : c)));
  };
  const fim = () => {
    const a = arrasto.current;
    arrasto.current = null;
    const c = a && carimbos.find((x) => x.usuarioId === a.id);
    if (c) void salvar(c);
  };

  const escala = largura && paginas[0] ? largura / paginas[0].largura : 1;
  const altura = alturas.reduce((s, h) => s + h, 0) + ESPACO * Math.max(paginas.length - 1, 0);
  const meus = carimbos.filter((c) => c.podeMover);

  return (
    <div className="space-y-3">
      {meus.length > 0 && (
        <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
          ✥ Toque e arraste {meus.length > 1 ? "um carimbo" : "o carimbo"} de assinatura (contorno azul) até o lugar desejado, em qualquer página. A posição é salva ao soltar e não muda o documento nem o código (hash) assinado.
        </p>
      )}
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      {erroPdf && <Aviso tipo="critico">Não foi possível mostrar as páginas aqui. Use &quot;Baixar / abrir PDF&quot;.</Aviso>}
      <div ref={caixa} className="relative w-full select-none" style={{ height: altura || undefined }}>
        {paginas.map((p, i) => (
          <canvas
            key={i}
            ref={(el) => {
              telas.current[i] = el;
            }}
            aria-label={`Página ${i + 1}`}
            className="absolute left-0 w-full rounded-sm bg-white shadow ring-1 ring-slate-200"
            style={{ top: topos[i], height: alturas[i] }}
          />
        ))}
        {largura > 0 &&
          carimbos.map((c) => {
            const t = paraTela(c.pos);
            return (
              <div
                key={c.usuarioId}
                role={c.podeMover ? "button" : undefined}
                aria-label={c.podeMover ? `Arrastar a assinatura de ${c.nome}` : `Assinatura de ${c.nome}`}
                data-carimbo={c.usuarioId}
                onPointerDown={(e) => inicio(e, c)}
                onPointerMove={mover}
                onPointerUp={fim}
                onPointerCancel={fim}
                className={c.podeMover ? "absolute cursor-grab outline-2 outline-offset-2 outline-sky-600 outline-dashed active:cursor-grabbing" : "absolute opacity-90"}
                style={{ left: t.left, top: t.top, width: CARIMBO.largura * escala, height: CARIMBO.altura * escala, touchAction: c.podeMover ? "none" : undefined }}
              >
                <CarimboPrevia nome={c.nome} data={c.data} codigo={codigo} endereco={endereco} escala={escala} />
                {!c.temLugar && <span className="absolute -top-5 left-0 rounded bg-amber-100 px-1 text-[11px] font-semibold text-amber-900">sugestão: arraste para o lugar</span>}
              </div>
            );
          })}
      </div>
      {meus.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {meus.map((c) => (
            <Botao
              key={c.usuarioId}
              variante="secundario"
              pequeno
              onClick={async () => {
                if (await salvar(c, { padrao: true })) window.location.reload();
              }}
            >
              Voltar ao lugar padrão{meus.length > 1 ? ` — ${c.nome}` : ""}
            </Botao>
          ))}
        </div>
      )}
    </div>
  );
}
