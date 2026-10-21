import { Calculadora } from "@/components/calc/Calculadora";
import { Titulo } from "@/components/ui";
import { propsCalculadora } from "@/lib/servicos/calc-props";

export const metadata = { title: "Calculadora trabalhista" };

export default async function PaginaCalculadora({ searchParams }: { searchParams: Promise<{ empregado?: string; ano?: string; mes?: string; aba?: string }> }) {
  const sp = await searchParams;
  const props = await propsCalculadora();
  return (
    <>
      <Titulo subtitulo="Cálculos com memória visível, usando as tabelas anuais cadastradas.">Calculadora trabalhista</Titulo>
      <Calculadora {...props} inicial={{ empregadoId: sp.empregado, ano: Number(sp.ano) || undefined, mes: Number(sp.mes) || undefined, aba: sp.aba }} />
    </>
  );
}
