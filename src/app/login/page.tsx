import { redirect } from "next/navigation";
import { Formulario } from "@/components/Formulario";
import { Campo } from "@/components/ui";
import { prisma } from "@/lib/db";
import { entrar } from "./acoes";

export const metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  // Sistema recém-publicado, sem nenhum consultor: vai para o primeiro acesso
  if (!(await prisma.usuario.count({ where: { papel: "CONSULTOR" } }))) redirect("/primeiro-acesso");
  const { voltar } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-marca-600 text-2xl font-bold text-white">eD</div>
          <h1 className="text-2xl font-bold">eSocial Doméstico</h1>
          <p className="text-slate-600">Gestão da consultoria, portal do cliente e ponto</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Formulario acao={entrar} textoBotao="Entrar" className="[&_button]:w-full">
            <input type="hidden" name="voltar" value={voltar ?? ""} />
            <Campo rotulo="E-mail" name="email" type="email" autoComplete="username" required inputMode="email" />
            <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" required />
          </Formulario>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Esqueceu a senha? Fale com o seu consultor. Seus dados são protegidos conforme a LGPD.
        </p>
      </div>
    </main>
  );
}
