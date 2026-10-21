import { FormNovaOcorrencia } from "@/components/disciplinar/FormNovaOcorrencia";
import { Cartao, Titulo } from "@/components/ui";
import { exigirCliente } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

export default async function Nova({ searchParams }: { searchParams: Promise<{ empregado?: string }> }) {
  const u = await exigirCliente();
  const empregados = await prisma.empregado.findMany({ where: { clienteId: u.clienteId, situacao: { not: "DESLIGADO" } }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  return (
    <>
      <Titulo subtitulo="O sistema vai sugerir a medida adequada e conferir os riscos antes de qualquer documento.">Nova ocorrência</Titulo>
      <Cartao><FormNovaOcorrencia empregados={empregados} empregadoId={(await searchParams).empregado} /></Cartao>
    </>
  );
}
