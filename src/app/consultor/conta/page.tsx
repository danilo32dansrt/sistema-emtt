import { PaginaConta } from "@/components/PaginaConta";
import { exigirConsultor } from "@/lib/auth/sessao";

export default async function Conta() {
  return <PaginaConta usuario={await exigirConsultor()} />;
}
