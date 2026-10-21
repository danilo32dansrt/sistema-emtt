import { PaginaDocumento } from "@/components/PaginaDocumento";
import { exigirConsultor } from "@/lib/auth/sessao";

export default async function Doc({ params }: { params: Promise<{ id: string }> }) {
  return <PaginaDocumento usuario={await exigirConsultor()} id={(await params).id} />;
}
