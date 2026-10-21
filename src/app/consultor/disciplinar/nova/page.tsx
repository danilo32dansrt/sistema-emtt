import { FormNovaOcorrencia } from "@/components/disciplinar/FormNovaOcorrencia";
import { Cartao, Titulo } from "@/components/ui";
import { prisma } from "@/lib/db";

export default async function Nova({ searchParams }: { searchParams: Promise<{ empregado?: string }> }) {
  const empregados = await prisma.empregado.findMany({ where: { situacao: { not: "DESLIGADO" }, cliente: { ativo: true } }, select: { id: true, nome: true, cliente: { select: { nome: true } } }, orderBy: { nome: "asc" } });
  return (
    <>
      <Titulo>Nova ocorrência</Titulo>
      <Cartao><FormNovaOcorrencia empregados={empregados.map((e) => ({ id: e.id, nome: `${e.nome} (${e.cliente.nome})` }))} empregadoId={(await searchParams).empregado} /></Cartao>
    </>
  );
}
