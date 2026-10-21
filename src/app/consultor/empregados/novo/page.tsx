import { Aviso, Cartao, LinkBotao, Titulo } from "@/components/ui";
import { prisma } from "@/lib/db";
import { FormEmpregado } from "../FormEmpregado";

export const metadata = { title: "Novo empregado" };

export default async function NovoEmpregado({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams;
  const clientes = await prisma.cliente.findMany({ where: { ativo: true, anonimizadoEm: null }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  return (
    <>
      <Titulo>Novo empregado</Titulo>
      {clientes.length === 0 ? (
        <Aviso tipo="aviso">Cadastre primeiro um cliente. <LinkBotao pequeno href="/consultor/clientes/novo">Novo cliente</LinkBotao></Aviso>
      ) : (
        <Cartao>
          <FormEmpregado clientes={clientes} clienteId={cliente} />
        </Cartao>
      )}
    </>
  );
}
