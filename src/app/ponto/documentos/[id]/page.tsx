import { PaginaDocumento } from "@/components/PaginaDocumento";
import { exigirEmpregado } from "@/lib/auth/sessao";

export default async function Doc({ params }: { params: Promise<{ id: string }> }) {
  return <PaginaDocumento usuario={await exigirEmpregado()} id={(await params).id} />;
}
