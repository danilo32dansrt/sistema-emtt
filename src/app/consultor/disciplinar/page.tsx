import { PainelDisciplinar } from "@/components/disciplinar/PainelDisciplinar";
import { LinkBotao, Titulo } from "@/components/ui";

export const metadata = { title: "Gestão disciplinar" };

export default function Disciplinar() {
  return (
    <>
      <Titulo subtitulo="Cópia de todas as ocorrências dos clientes. Dossiês de justa causa aguardam sua revisão." acoes={<><LinkBotao variante="secundario" href="/consultor/disciplinar/orientacao">Central de orientação</LinkBotao><LinkBotao href="/consultor/disciplinar/nova">+ Nova ocorrência</LinkBotao></>}>Gestão disciplinar</Titulo>
      <PainelDisciplinar base="/consultor/disciplinar" />
    </>
  );
}
