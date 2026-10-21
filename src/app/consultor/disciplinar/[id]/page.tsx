import { DetalheOcorrencia } from "@/components/disciplinar/DetalheOcorrencia";
import { exigirConsultor } from "@/lib/auth/sessao";

export default async function Ocorrencia({ params }: { params: Promise<{ id: string }> }) {
  return <DetalheOcorrencia usuario={await exigirConsultor()} id={(await params).id} />;
}
