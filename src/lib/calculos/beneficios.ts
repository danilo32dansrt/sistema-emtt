import { arred, formatarMoeda } from "./dinheiro";
import type { TabelaAnual } from "./tabelas";

/**
 * Salário-família: devido por filho de até 14 anos (ou inválido) quando a
 * remuneração do mês não passa do limite da tabela vigente. O empregador
 * paga junto com o salário e deduz do DAE.
 */
export function calcularSalarioFamilia(
  remuneracao: number,
  dependentes: number,
  tabela: TabelaAnual,
  proporcao = 1,
) {
  if (dependentes <= 0) return { direito: false, valor: 0, motivo: "Sem dependentes cadastrados." };
  if (remuneracao > tabela.salarioFamiliaLimite) {
    return {
      direito: false,
      valor: 0,
      motivo: `Remuneração ${formatarMoeda(remuneracao)} acima do limite de ${formatarMoeda(tabela.salarioFamiliaLimite)}.`,
    };
  }
  const valor = arred(tabela.salarioFamiliaCota * dependentes * proporcao);
  return {
    direito: true,
    valor,
    motivo: `${dependentes} cota(s) de ${formatarMoeda(tabela.salarioFamiliaCota)}${proporcao < 1 ? " (proporcional)" : ""}.`,
  };
}

/**
 * Vale-transporte: o empregado pode ter descontado até 6% do salário básico;
 * o que passar disso é custo do empregador (Lei 7.418/1985 e LC 150, art. 19).
 */
export function calcularValeTransporte(salarioBase: number, custoMensalPassagens: number) {
  const limite = arred(salarioBase * 0.06);
  const desconto = arred(Math.min(limite, custoMensalPassagens));
  return {
    custo: arred(custoMensalPassagens),
    descontoEmpregado: desconto,
    custoEmpregador: arred(custoMensalPassagens - desconto),
    formula: `Desconto = menor entre 6% do salário (${formatarMoeda(limite)}) e o custo (${formatarMoeda(custoMensalPassagens)})`,
  };
}
