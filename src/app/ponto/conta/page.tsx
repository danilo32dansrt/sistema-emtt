import Link from "next/link";
import { PaginaConta } from "@/components/PaginaConta";
import { exigirEmpregado } from "@/lib/auth/sessao";

export default async function Conta() {
  const u = await exigirEmpregado();
  return (
    <>
      <PaginaConta usuario={u} />
      <p className="mt-4 text-sm"><Link className="text-marca-700 underline" href="/ponto/privacidade">Aviso de privacidade</Link>{u.consentimentoLgpdEm && ` — ciência registrada em ${u.consentimentoLgpdEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}</p>
    </>
  );
}
