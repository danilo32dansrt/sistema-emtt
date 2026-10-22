import { redirect } from "next/navigation";
import { Formulario } from "@/components/Formulario";
import { Campo } from "@/components/ui";
import { prisma } from "@/lib/db";
import { criarPrimeiroConsultor } from "./acoes";

export const metadata = { title: "Primeiro acesso" };
export const dynamic = "force-dynamic";

export default async function PrimeiroAcesso() {
  if (await prisma.usuario.count({ where: { papel: "CONSULTOR" } })) redirect("/login");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="text-2xl font-bold text-marca-700">Primeiro acesso</h1>
      <p className="mb-6 mt-2 text-slate-600">Crie a sua conta de consultor. Depois você cadastra os clientes e as empregadas, e cria o acesso de cada um pelo próprio sistema.</p>
      <Formulario acao={criarPrimeiroConsultor} textoBotao="Criar minha conta e entrar">
        <Campo rotulo="Seu nome" name="nome" required autoComplete="name" />
        <Campo rotulo="E-mail" name="email" type="email" required autoComplete="email" />
        <Campo rotulo="Senha (mínimo 8 caracteres)" name="senha" type="password" required minLength={8} autoComplete="new-password" />
        <Campo rotulo="Repita a senha" name="confirmar" type="password" required minLength={8} autoComplete="new-password" />
      </Formulario>
    </main>
  );
}
