import Link from "next/link";
import type { ReactNode } from "react";
import { sair } from "@/app/login/acoes";
import { LinkAtivo } from "./LinkAtivo";

export interface ItemMenu {
  href: string;
  rotulo: string;
  icone: string;
  contador?: number;
}

/** Estrutura das páginas: menu lateral no computador e menu recolhível no celular. */
export function Casca({ titulo, usuario, itens, children }: { titulo: string; usuario: string; itens: ItemMenu[]; children: ReactNode }) {
  const menu = (
    <nav className="flex flex-col gap-1">
      {itens.map((i) => (
        <LinkAtivo key={i.href} href={i.href} raiz={i.href === itens[0].href}>
          <span aria-hidden className="w-6 text-center">{i.icone}</span>
          <span className="flex-1">{i.rotulo}</span>
          {!!i.contador && <span className="rounded-full bg-red-600 px-2 text-xs font-bold text-white">{i.contador}</span>}
        </LinkAtivo>
      ))}
      <form action={sair} className="mt-2 border-t border-slate-200 pt-2">
        <button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-slate-600 hover:bg-slate-100">
          <span aria-hidden className="w-6 text-center">⎋</span> Sair
        </button>
      </form>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="nao-imprimir hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
        <Link href={itens[0].href} className="mb-4 block">
          <p className="text-lg font-bold text-marca-700">{titulo}</p>
          <p className="truncate text-sm text-slate-500">{usuario}</p>
        </Link>
        {menu}
      </aside>
      <header className="nao-imprimir sticky top-0 z-20 border-b border-slate-200 bg-white lg:hidden">
        <details className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4">
            <span>
              <span className="block font-bold text-marca-700">{titulo}</span>
              <span className="block text-xs text-slate-500">{usuario}</span>
            </span>
            <span className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold">
              <span className="group-open:hidden">☰ Menu</span>
              <span className="hidden group-open:inline">✕ Fechar</span>
            </span>
          </summary>
          <div className="max-h-[75vh] overflow-y-auto border-t border-slate-200 p-3">{menu}</div>
        </details>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
