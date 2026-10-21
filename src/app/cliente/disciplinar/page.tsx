import { PainelDisciplinar } from "@/components/disciplinar/PainelDisciplinar";
import { LinkBotao, Titulo } from "@/components/ui";
import { exigirCliente } from "@/lib/auth/sessao";

export const metadata = { title: "Gestão disciplinar" };

export default async function Disciplinar() {
  const u = await exigirCliente();
  return (
    <>
      <Titulo subtitulo="Registre ocorrências e aplique medidas com segurança, passo a passo. O consultor recebe cópia de tudo." acoes={<><LinkBotao variante="secundario" href="/cliente/disciplinar/orientacao">Central de orientação</LinkBotao><LinkBotao href="/cliente/disciplinar/nova">+ Nova ocorrência</LinkBotao></>}>Gestão disciplinar</Titulo>
      <PainelDisciplinar clienteId={u.clienteId} base="/cliente/disciplinar" />
    </>
  );
}
