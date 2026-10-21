import { Calculadora } from "@/components/calc/Calculadora";
import { Simuladores } from "@/components/calc/Simuladores";
import { Aviso, LinkBotao, Titulo } from "@/components/ui";
import { exigirCliente } from "@/lib/auth/sessao";
import { propsCalculadora } from "@/lib/servicos/calc-props";

export const metadata = { title: "Simuladores" };

export default async function Pagina() {
  const u = await exigirCliente();
  const props = await propsCalculadora(u.clienteId);
  return (
    <>
      <Titulo subtitulo="Faça contas antes de decidir. Os valores são estimativas." acoes={<LinkBotao href="/cliente/simuladores/beneficios">Benefícios da empregada (carteira x informal)</LinkBotao>}>Simuladores</Titulo>
      <Simuladores tabelas={props.tabelas} ano={Number(props.hoje.slice(0, 4))} />
      <h2 className="mb-3 mt-8 text-xl font-bold">Rescisão, férias, 13º e regularização</h2>
      <div className="mb-3"><Aviso tipo="aviso">Antes de desligar alguém, fale com o consultor: há prazos e documentos obrigatórios.</Aviso></div>
      <Calculadora {...props} inicial={{ aba: "rescisao" }} />
    </>
  );
}
