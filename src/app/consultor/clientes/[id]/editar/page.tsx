import { notFound } from "next/navigation";
import { Cartao, Titulo } from "@/components/ui";
import { prisma } from "@/lib/db";
import { FormCliente } from "../../FormCliente";

export default async function EditarCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente) notFound();
  return (
    <>
      <Titulo>Editar cliente</Titulo>
      <Cartao>
        <FormCliente cliente={cliente} />
      </Cartao>
    </>
  );
}
