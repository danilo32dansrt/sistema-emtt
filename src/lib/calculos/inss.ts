import { aplicarModo, arred, formatarMoeda, type ModoArredondamento } from "./dinheiro";
import { Memoria } from "./memoria";
import { tetoInss, type TabelaAnual } from "./tabelas";

export interface ResultadoInss {
  base: number;
  baseLimitada: number;
  valor: number;
  aliquotaEfetiva: number;
  memoria: Memoria;
}

/** INSS do empregado pela tabela progressiva (cada faixa tributa só a parte do salário dentro dela). */
export function calcularInssEmpregado(
  base: number,
  tabela: TabelaAnual,
  modo: ModoArredondamento = tabela.arredondamentoDae,
): ResultadoInss {
  const memoria = new Memoria();
  const teto = tetoInss(tabela);
  const baseLimitada = Math.min(Math.max(base, 0), teto);
  if (base > teto) memoria.nota(`Base ${formatarMoeda(base)} acima do teto; limitada a ${formatarMoeda(teto)}.`);

  let anterior = 0;
  let total = 0;
  tabela.faixasInss.forEach((faixa, i) => {
    if (baseLimitada <= anterior) return;
    const parcela = Math.min(baseLimitada, faixa.ate) - anterior;
    const imposto = (parcela * faixa.aliquota) / 100;
    total += imposto;
    memoria.add(
      `Faixa ${i + 1} (até ${formatarMoeda(faixa.ate)})`,
      arred(imposto, 4),
      `${formatarMoeda(arred(parcela))} × ${faixa.aliquota}%`,
    );
    anterior = faixa.ate;
  });

  const valor = aplicarModo(total, modo);
  memoria.destaque("INSS do empregado", valor, modo === "truncar" ? "soma das faixas (truncada no centavo)" : "soma das faixas");
  return {
    base,
    baseLimitada,
    valor,
    aliquotaEfetiva: baseLimitada > 0 ? arred((valor / baseLimitada) * 100, 2) : 0,
    memoria,
  };
}
