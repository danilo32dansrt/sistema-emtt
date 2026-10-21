import Link from "next/link";
import { sair } from "@/app/login/acoes";
import { exigirEmpregado } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

export const metadata = { title: "Ponto" };

export default async function LayoutPonto({ children }: { children: React.ReactNode }) {
  const u = await exigirEmpregado();
  const avisos = await prisma.notificacao.count({ where: { usuarioId: u.id, lidaEm: null } });
  const itens = [
    { href: "/ponto", rotulo: "Ponto", icone: "⏱️" },
    { href: "/ponto/historico", rotulo: "Histórico", icone: "📋" },
    { href: "/ponto/justificativas", rotulo: "Justificar", icone: "📝" },
    { href: "/ponto/documentos", rotulo: "Documentos", icone: "📄" },
    { href: "/ponto/conta", rotulo: "Conta", icone: "👤" },
  ];
  return (
    <div className="mx-auto min-h-screen max-w-md pb-24">
      <header className="nao-imprimir flex items-center justify-between px-4 py-3">
        <p className="font-bold text-marca-700">Ponto Doméstico</p>
        <span className="flex items-center gap-3">
          <Link href="/ponto/avisos" className="relative rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold" aria-label={`Avisos${avisos ? ` (${avisos} novos)` : ""}`}>
            🔔{!!avisos && <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{avisos}</span>}
          </Link>
          <form action={sair}><button className="text-sm text-slate-500">Sair</button></form>
        </span>
      </header>
      <main className="px-4">{children}</main>
      <nav className="nao-imprimir fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {itens.map((i) => (
            <Link key={i.href} href={i.href} className="flex min-h-16 flex-col items-center justify-center text-xs font-medium text-slate-700">
              <span className="text-xl" aria-hidden>{i.icone}</span>
              {i.rotulo}
            </Link>
          ))}
        </div>
      </nav>
      <span className="sr-only">{u.nome}</span>
    </div>
  );
}
