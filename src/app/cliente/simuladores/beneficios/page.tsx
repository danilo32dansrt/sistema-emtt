import { SimuladorBeneficios } from "@/components/calc/SimuladorBeneficios";
import { Titulo } from "@/components/ui";
import { hojeBrasil } from "@/lib/calculos";
import { parametrosSociaisHoje, tabelaNaDataDb } from "@/lib/tabelas-db";

export const metadata = { title: "Simulador de benefícios" };

export default async function Beneficios() {
  const [params, { tabela }] = await Promise.all([parametrosSociaisHoje(), tabelaNaDataDb(hojeBrasil())]);
  return (
    <>
      <Titulo subtitulo="Mostre à trabalhadora, com os números da família dela, o que muda nos benefícios com a carteira assinada — e os direitos e deveres que ela passa a ter.">Carteira assinada x informal</Titulo>
      <SimuladorBeneficios params={params} tabela={tabela} />
    </>
  );
}
