import { Calculadora } from "@/components/calc/Calculadora";
import { Simuladores } from "@/components/calc/Simuladores";
import { LinkBotao, Titulo } from "@/components/ui";
import { propsCalculadora } from "@/lib/servicos/calc-props";

export const metadata = { title: "Simuladores" };

export default async function Pagina() {
  const props = await propsCalculadora();
  return (
    <>
      <Titulo subtitulo="Estimativas com memória de cálculo para apresentar ao cliente." acoes={<LinkBotao href="/consultor/simuladores/beneficios">Benefícios da empregada (carteira x informal)</LinkBotao>}>Simuladores</Titulo>
      <Simuladores tabelas={props.tabelas} ano={Number(props.hoje.slice(0, 4))} />
      <h2 className="mb-3 mt-8 text-xl font-bold">Rescisão, férias, 13º e regularização</h2>
      <Calculadora {...props} inicial={{ aba: "rescisao" }} />
    </>
  );
}
