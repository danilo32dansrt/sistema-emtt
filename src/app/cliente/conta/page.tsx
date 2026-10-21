import { PaginaConta } from "@/components/PaginaConta";
import { exigirCliente } from "@/lib/auth/sessao";

export default async function Conta() {
  return <PaginaConta usuario={await exigirCliente()} />;
}
