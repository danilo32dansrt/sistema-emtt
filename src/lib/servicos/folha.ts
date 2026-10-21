import "server-only";
import type { Empregado, LancamentoMensal } from "@prisma/client";
import { calcularFolhaMensal } from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { tabelaDoAno } from "@/lib/tabelas-db";

/** Folha estimada do mês a partir do cadastro e das informações enviadas (cliente ou ponto). */
export async function folhaDoMes(e: Empregado, ano: number, mes: number, l?: LancamentoMensal | null) {
  const { tabela, aproximada } = await tabelaDoAno(ano);
  const folha = calcularFolhaMensal({
    ano,
    mes,
    salario: num(e.salario),
    horasSemanais: num(e.horasSemanais),
    admissao: e.admissao,
    desligamento: e.desligamento,
    tabela,
    faltasInjustificadas: l?.faltasInjustificadas,
    semanasComFalta: l?.semanasComFalta,
    diasSuspensao: l?.diasSuspensao,
    atrasoMinutos: l?.atrasoMinutos,
    horasExtras50: num(l?.horasExtras50),
    horasExtras100: num(l?.horasExtras100),
    horasNoturnas: num(l?.horasNoturnas),
    horasViagem: num(l?.horasViagem),
    horasIntervaloSuprimido: num(l?.horasIntervaloSuprimido),
    adiantamento: num(l?.adiantamento),
    outrosProventos: num(l?.outrosProventos),
    outrosDescontos: num(l?.outrosDescontos),
    dependentesSalarioFamilia: e.dependentesSalarioFamilia,
    custoValeTransporte: num(e.custoValeTransporte),
  });
  return { folha, tabelaAproximada: aproximada };
}
