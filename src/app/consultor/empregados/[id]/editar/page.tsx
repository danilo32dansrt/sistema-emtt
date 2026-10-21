import { notFound } from "next/navigation";
import { Cartao, Titulo } from "@/components/ui";
import { prisma } from "@/lib/db";
import { FormEmpregado } from "../../FormEmpregado";

export default async function EditarEmpregado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [empregado, clientes] = await Promise.all([
    prisma.empregado.findUnique({ where: { id } }),
    prisma.cliente.findMany({ where: { anonimizadoEm: null }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  if (!empregado) notFound();
  return (
    <>
      <Titulo>Editar {empregado.nome}</Titulo>
      <Cartao>
        <FormEmpregado empregado={empregado} clientes={clientes} />
      </Cartao>
    </>
  );
}
