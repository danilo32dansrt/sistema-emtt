import { Cartao, Titulo } from "@/components/ui";
import { FormCliente } from "../FormCliente";

export const metadata = { title: "Novo cliente" };

export default function NovoCliente() {
  return (
    <>
      <Titulo subtitulo="Dados do empregador doméstico atendido pela consultoria.">Novo cliente</Titulo>
      <Cartao>
        <FormCliente />
      </Cartao>
    </>
  );
}
