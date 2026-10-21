import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatarMoeda, formatarNumero, type LinhaMemoria } from "@/lib/calculos";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Titulo({ children, subtitulo, acoes }: { children: ReactNode; subtitulo?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{children}</h1>
        {subtitulo && <p className="mt-1 text-slate-600">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Cartao({ children, titulo, className, acoes }: { children: ReactNode; titulo?: ReactNode; className?: string; acoes?: ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5", className)}>
      {(titulo || acoes) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titulo && <h2 className="text-lg font-semibold text-slate-800">{titulo}</h2>}
          {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const estilosBotao = {
  primario: "bg-marca-600 text-white hover:bg-marca-700 disabled:bg-slate-400",
  secundario: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  perigo: "bg-red-600 text-white hover:bg-red-700",
  sucesso: "bg-emerald-600 text-white hover:bg-emerald-700",
  whatsapp: "bg-[#25D366] text-white hover:bg-[#1da851]",
  fantasma: "text-marca-700 hover:bg-marca-50",
} as const;

export type VarianteBotao = keyof typeof estilosBotao;

export function classeBotao(variante: VarianteBotao = "primario", pequeno = false) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-marca-200 disabled:cursor-not-allowed",
    pequeno ? "min-h-9 px-3 text-sm" : "min-h-12 px-5 text-base",
    estilosBotao[variante],
  );
}

export function Botao({ variante = "primario", pequeno, className, ...props }: ComponentProps<"button"> & { variante?: VarianteBotao; pequeno?: boolean }) {
  return <button {...props} className={cx(classeBotao(variante, pequeno), className)} />;
}

export function LinkBotao({ variante = "primario", pequeno, className, ...props }: ComponentProps<typeof Link> & { variante?: VarianteBotao; pequeno?: boolean }) {
  return <Link {...props} className={cx(classeBotao(variante, pequeno), className)} />;
}

export function Rotulo({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
      {children}
    </label>
  );
}

const classeCampo =
  "block w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-marca-500 focus:outline-none focus:ring-4 focus:ring-marca-100";

export function Campo({ rotulo, ajuda, className, ...props }: ComponentProps<"input"> & { rotulo: ReactNode; ajuda?: ReactNode }) {
  const id = props.id ?? props.name;
  return (
    <div className={className}>
      <Rotulo htmlFor={id}>{rotulo}</Rotulo>
      <input id={id} {...props} className={classeCampo} />
      {ajuda && <p className="mt-1 text-xs text-slate-500">{ajuda}</p>}
    </div>
  );
}

export function AreaTexto({ rotulo, className, ...props }: ComponentProps<"textarea"> & { rotulo: ReactNode }) {
  const id = props.id ?? props.name;
  return (
    <div className={className}>
      <Rotulo htmlFor={id}>{rotulo}</Rotulo>
      <textarea id={id} rows={3} {...props} className={cx(classeCampo, "py-2")} />
    </div>
  );
}

export function Selecao({ rotulo, opcoes, className, ajuda, ...props }: ComponentProps<"select"> & { rotulo: ReactNode; opcoes: { valor: string; rotulo: string }[]; ajuda?: ReactNode }) {
  const id = props.id ?? props.name;
  return (
    <div className={className}>
      <Rotulo htmlFor={id}>{rotulo}</Rotulo>
      <select id={id} {...props} className={classeCampo}>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      {ajuda && <p className="mt-1 text-xs text-slate-500">{ajuda}</p>}
    </div>
  );
}

export function Marcador({ rotulo, className, ...props }: ComponentProps<"input"> & { rotulo: ReactNode }) {
  return (
    <label className={cx("flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 hover:bg-slate-50", className)}>
      <input type="checkbox" {...props} className="h-5 w-5 accent-marca-600" />
      <span className="text-sm text-slate-800">{rotulo}</span>
    </label>
  );
}

const estilosSelo = {
  cinza: "bg-slate-100 text-slate-700",
  verde: "bg-emerald-100 text-emerald-800",
  amarelo: "bg-amber-100 text-amber-800",
  vermelho: "bg-red-100 text-red-800",
  azul: "bg-marca-100 text-marca-700",
} as const;

export function Selo({ children, cor = "cinza" }: { children: ReactNode; cor?: keyof typeof estilosSelo }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", estilosSelo[cor])}>{children}</span>;
}

const estilosAviso = {
  info: "border-marca-200 bg-marca-50 text-marca-900",
  aviso: "border-amber-200 bg-amber-50 text-amber-900",
  critico: "border-red-200 bg-red-50 text-red-900",
  sucesso: "border-emerald-200 bg-emerald-50 text-emerald-900",
} as const;

export function Aviso({ children, tipo = "info", titulo }: { children: ReactNode; tipo?: keyof typeof estilosAviso; titulo?: ReactNode }) {
  return (
    <div className={cx("rounded-xl border px-4 py-3 text-sm", estilosAviso[tipo])} role={tipo === "critico" ? "alert" : undefined}>
      {titulo && <p className="font-semibold">{titulo}</p>}
      <div>{children}</div>
    </div>
  );
}

export function Indicador({ rotulo, valor, cor = "azul", href, detalhe }: { rotulo: string; valor: ReactNode; cor?: "azul" | "vermelho" | "amarelo" | "verde"; href?: string; detalhe?: ReactNode }) {
  const cores = {
    azul: "text-marca-700",
    vermelho: "text-red-700",
    amarelo: "text-amber-700",
    verde: "text-emerald-700",
  };
  const conteudo = (
    <div className={cx("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", href && "transition hover:border-marca-300 hover:shadow")}>
      <p className="text-sm text-slate-600">{rotulo}</p>
      <p className={cx("mt-1 text-3xl font-bold", cores[cor])}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
  return href ? <Link href={href}>{conteudo}</Link> : conteudo;
}

export function Tabela({ cabecalho, children, vazio }: { cabecalho: ReactNode[]; children: ReactNode; vazio?: ReactNode }) {
  const temLinhas = Array.isArray(children) ? children.flat().filter(Boolean).length > 0 : Boolean(children);
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {cabecalho.map((c, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {temLinhas ? children : (
            <tr>
              <td colSpan={cabecalho.length} className="px-3 py-6 text-center text-slate-500">
                {vazio ?? "Nenhum registro."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Celula({ children, className, ...props }: ComponentProps<"td">) {
  return (
    <td {...props} className={cx("px-3 py-2 align-top", className)}>
      {children}
    </td>
  );
}

export function Moeda({ valor, className }: { valor: number; className?: string }) {
  return <span className={cx("whitespace-nowrap tabular-nums", valor < 0 && "text-red-700", className)}>{formatarMoeda(valor)}</span>;
}

function valorLinha(l: LinhaMemoria) {
  if (l.valor === undefined) return l.formula ?? "";
  switch (l.tipo) {
    case "numero":
      return String(l.valor);
    case "dias":
      return `${l.valor} dias`;
    case "horas":
      return `${formatarNumero(l.valor)} h`;
    case "percentual":
      return `${formatarNumero(l.valor)}%`;
    default:
      return formatarMoeda(l.valor);
  }
}

/** Mostra a memória de cálculo em formato de lista legível. */
export function MemoriaCalculo({ linhas, titulo = "Memória de cálculo" }: { linhas: LinhaMemoria[]; titulo?: string }) {
  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50" open>
      <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-slate-800">{titulo}</summary>
      <ul className="divide-y divide-slate-200 border-t border-slate-200">
        {linhas.map((l, i) =>
          l.tipo === "texto" && l.valor === undefined && !l.formula ? (
            <li key={i} className="px-4 py-2 text-sm italic text-slate-600">
              {l.descricao}
            </li>
          ) : (
            <li key={i} className={cx("flex flex-col gap-0.5 px-4 py-2 text-sm sm:flex-row sm:items-baseline sm:justify-between", l.destaque && "bg-white font-bold")}>
              <div>
                <span className="text-slate-800">{l.descricao}</span>
                {l.formula && l.valor !== undefined && <span className="block text-xs text-slate-500">{l.formula}</span>}
              </div>
              <span className="tabular-nums text-slate-900 sm:ml-4 sm:text-right">{valorLinha(l)}</span>
            </li>
          ),
        )}
      </ul>
    </details>
  );
}

export function AvisoEstimativa() {
  return (
    <p className="mt-4 text-xs text-slate-500">
      <strong>Aviso:</strong> os cálculos são estimativas de apoio; os valores oficiais são os gerados pelo eSocial, e questões judiciais devem ser encaminhadas a um advogado.
    </p>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">{children}</p>;
}

export function Grade({ children, colunas = 2 }: { children: ReactNode; colunas?: 1 | 2 | 3 | 4 }) {
  const c = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[colunas];
  return <div className={cx("grid grid-cols-1 gap-4", c)}>{children}</div>;
}
