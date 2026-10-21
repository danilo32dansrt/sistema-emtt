import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/sessao";
import { inicioPorPapel } from "@/lib/auth/token";

export default async function Inicio() {
  const u = await usuarioAtual();
  redirect(u ? inicioPorPapel(u.papel) : "/login");
}
