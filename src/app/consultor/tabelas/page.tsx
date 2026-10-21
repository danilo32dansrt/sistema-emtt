import { redirect } from "next/navigation";

/** Endereço antigo: as tabelas anuais agora fazem parte dos parâmetros legais. */
export default function Tabelas() {
  redirect("/consultor/parametros");
}
