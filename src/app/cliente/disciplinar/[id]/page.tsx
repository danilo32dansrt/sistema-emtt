import { DetalheOcorrencia } from "@/components/disciplinar/DetalheOcorrencia";
import { exigirCliente } from "@/lib/auth/sessao";

export default async function Ocorrencia({ params }: { params: Promise<{ id: string }> }) {
  return <DetalheOcorrencia usuario={await exigirCliente()} id={(await params).id} />;
}
