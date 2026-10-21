import { Conversa } from "@/components/Conversa";
import { Titulo } from "@/components/ui";
import { marcarLidas } from "@/app/acoes-mensagens";
import { exigirCliente } from "@/lib/auth/sessao";

export const metadata = { title: "Mensagens" };

export default async function Mensagens() {
  const u = await exigirCliente();
  await marcarLidas(u.clienteId, "CLIENTE");
  return (
    <>
      <Titulo subtitulo="Tire dúvidas e envie informações. O histórico fica guardado.">Falar com o consultor</Titulo>
      <Conversa clienteId={u.clienteId} usuarioId={u.id} />
    </>
  );
}
