"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function LinkAtivo({ href, children, raiz }: { href: string; children: ReactNode; raiz?: boolean }) {
  const caminho = usePathname();
  const ativo = raiz ? caminho === href : caminho === href || caminho.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={(e) => (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open")}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${ativo ? "bg-marca-50 text-marca-700" : "text-slate-700 hover:bg-slate-100"}`}
    >
      {children}
    </Link>
  );
}
