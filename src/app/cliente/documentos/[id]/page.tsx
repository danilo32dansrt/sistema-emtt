import { PaginaDocumento } from "@/components/PaginaDocumento";
import { exigirCliente } from "@/lib/auth/sessao";

export default async function Doc({ params }: { params: Promise<{ id: string }> }) {
  return <PaginaDocumento usuario={await exigirCliente()} id={(await params).id} />;
}
