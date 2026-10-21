import { arred, formatarMoeda, somar } from "./dinheiro";
import { calcularInssEmpregado } from "./inss";
import type { ParametrosSociais } from "./parametros";
import type { TabelaAnual } from "./tabelas";

/**
 * Simulador para a empregada: o que acontece com os benefícios sociais com a carteira
 * assinada x sem carteira, e quais direitos e deveres ela passa a ter.
 *
 * Princípio: o CadÚnico considera TODA a renda, com ou sem carteira. O simulador
 * esclarece — nunca sugere omitir renda ou deixar de atualizar o cadastro.
 */

export const AVISO_BENEFICIOS = "Simulação estimada. Confirme no CRAS ou no app Bolsa Família.";

export interface PessoaFamilia {
  nome: string;
  idade: number;
  /** Renda bruta mensal (trabalho, pensão, aposentadoria etc.), sem contar o Bolsa Família. */
  renda: number;
  ehEmpregada?: boolean;
  gestante?: boolean;
  /** Mãe amamentando bebê de até 6 meses. */
  nutriz?: boolean;
  /** Recebe BPC (idoso ou pessoa com deficiência). O valor do BPC vai em `valorBpc`, fora da `renda`. */
  recebeBpc?: boolean;
  valorBpc?: number;
}

export interface EntradaBeneficiosSociais {
  pessoas: PessoaFamilia[];
  salarioProposto: number;
  recebeBolsaFamilia: boolean;
  /** Valor atual do Bolsa Família; se omitido, é estimado pela composição da família. */
  valorBolsaFamilia?: number;
  params: ParametrosSociais;
  tabela: TabelaAnual;
}

export type SituacaoBolsaFamilia = "integral" | "protecao" | "fora" | "nao_recebe";

export interface Cenario {
  rendaFamiliar: number;
  rendaPerCapita: number;
  bolsaFamilia: { situacao: SituacaoBolsaFamilia; valorMensal: number; meses: number | null; explicacao: string };
  rendaEmpregadaBruta: number;
  rendaEmpregadaLiquida: number;
  totalMensalFamilia: number;
}

/** Estimativa do Bolsa Família pela composição (Lei 14.601/2023), com os valores da tabela de parâmetros. */
export function estimarBolsaFamilia(pessoas: PessoaFamilia[], p: ParametrosSociais) {
  const n = pessoas.length;
  const cidadania = p.bfRendaCidadania * n;
  const base = Math.max(cidadania, p.bfMinimoFamilia);
  const criancas06 = pessoas.filter((x) => x.idade <= 6).length;
  const variaveis = pessoas.filter((x) => x.gestante || x.nutriz || (x.idade >= 7 && x.idade <= 17)).length;
  const valor = arred(base + criancas06 * p.bfPrimeiraInfancia + variaveis * p.bfVariavelFamiliar);
  return {
    valor,
    detalhe: [
      `${n} pessoa(s) × ${formatarMoeda(p.bfRendaCidadania)} = ${formatarMoeda(cidadania)}${base > cidadania ? ` (complementado até o mínimo de ${formatarMoeda(p.bfMinimoFamilia)})` : ""}`,
      criancas06 ? `${criancas06} criança(s) de 0 a 6 anos × ${formatarMoeda(p.bfPrimeiraInfancia)}` : "",
      variaveis ? `${variaveis} gestante(s), nutriz(es) ou criança(s)/adolescente(s) de 7 a 17 × ${formatarMoeda(p.bfVariavelFamiliar)}` : "",
    ].filter(Boolean),
  };
}

function situacaoBolsa(perCapita: number, recebe: boolean, valor: number, p: ParametrosSociais): Cenario["bolsaFamilia"] {
  if (!recebe) {
    return perCapita <= p.bfLinhaPobreza
      ? { situacao: "nao_recebe", valorMensal: 0, meses: null, explicacao: `A família não recebe hoje, mas a renda por pessoa (${formatarMoeda(perCapita)}) está dentro do limite de ${formatarMoeda(p.bfLinhaPobreza)}. Vale procurar o CRAS.` }
      : { situacao: "nao_recebe", valorMensal: 0, meses: null, explicacao: "A família não recebe o Bolsa Família." };
  }
  if (perCapita <= p.bfLinhaPobreza) {
    return { situacao: "integral", valorMensal: valor, meses: null, explicacao: `A renda por pessoa (${formatarMoeda(perCapita)}) fica dentro do limite de ${formatarMoeda(p.bfLinhaPobreza)}: o Bolsa Família continua integral.` };
  }
  if (perCapita <= p.bfProtecaoLimite) {
    const v = arred((valor * p.bfProtecaoPercentual) / 100);
    return { situacao: "protecao", valorMensal: v, meses: p.bfProtecaoMeses, explicacao: `A renda por pessoa (${formatarMoeda(perCapita)}) passa de ${formatarMoeda(p.bfLinhaPobreza)}, mas fica até ${formatarMoeda(p.bfProtecaoLimite)}: a família entra na regra de proteção e recebe ${p.bfProtecaoPercentual}% do benefício (${formatarMoeda(v)}) por até ${p.bfProtecaoMeses} meses.` };
  }
  return { situacao: "fora", valorMensal: 0, meses: null, explicacao: `A renda por pessoa (${formatarMoeda(perCapita)}) passa de ${formatarMoeda(p.bfProtecaoLimite)}: a família deixa o programa. Se a renda cair depois, pode voltar com prioridade (retorno garantido).` };
}

export function simularBeneficiosSociais(e: EntradaBeneficiosSociais) {
  const { params: p, tabela } = e;
  const n = Math.max(1, e.pessoas.length);
  const empregada = e.pessoas.find((x) => x.ehEmpregada) ?? e.pessoas[0];
  const outrasRendas = somar(...e.pessoas.filter((x) => x !== empregada).map((x) => x.renda));
  const bpcFamilia = somar(...e.pessoas.map((x) => (x.recebeBpc ? x.valorBpc ?? p.salarioMinimo : 0)));
  const estimativa = estimarBolsaFamilia(e.pessoas, p);
  const valorBolsa = e.valorBolsaFamilia ?? estimativa.valor;

  // Sem carteira: renda atual da empregada (deve estar informada no CadÚnico)
  const rendaSem = somar(outrasRendas, empregada?.renda ?? 0);
  const perCapitaSem = arred(rendaSem / n);
  const bolsaSem = situacaoBolsa(perCapitaSem, e.recebeBolsaFamilia, valorBolsa, p);
  const semCarteira: Cenario = {
    rendaFamiliar: rendaSem,
    rendaPerCapita: perCapitaSem,
    bolsaFamilia: bolsaSem,
    rendaEmpregadaBruta: empregada?.renda ?? 0,
    rendaEmpregadaLiquida: empregada?.renda ?? 0,
    totalMensalFamilia: somar(rendaSem, bolsaSem.valorMensal, bpcFamilia),
  };

  // Com carteira: salário bruto entra na renda (o CadÚnico considera a renda bruta)
  const inss = calcularInssEmpregado(e.salarioProposto, tabela).valor;
  const liquido = somar(e.salarioProposto, -inss);
  const rendaCom = somar(outrasRendas, e.salarioProposto);
  const perCapitaCom = arred(rendaCom / n);
  const bolsaCom = situacaoBolsa(perCapitaCom, e.recebeBolsaFamilia, valorBolsa, p);
  const comCarteira: Cenario = {
    rendaFamiliar: rendaCom,
    rendaPerCapita: perCapitaCom,
    bolsaFamilia: bolsaCom,
    rendaEmpregadaBruta: e.salarioProposto,
    rendaEmpregadaLiquida: liquido,
    totalMensalFamilia: somar(outrasRendas, liquido, bolsaCom.valorMensal, bpcFamilia),
  };

  // BPC: o próprio BPC de idoso/PcD não entra na conta (Lei 8.742, art. 20, § 14)
  const alertasBpc: string[] = [];
  const limiteBpc = arred(p.salarioMinimo * p.bpcFracaoSm);
  if (e.pessoas.some((x) => x.recebeBpc)) {
    const perCapitaBpc = arred(rendaCom / n);
    if (empregada?.recebeBpc) {
      alertasBpc.push("A própria trabalhadora recebe BPC: ao começar a trabalhar com carteira, o BPC por deficiência é suspenso, mas ela pode ter direito ao auxílio-inclusão. Antes de assinar, procure o INSS ou o CRAS.");
    }
    if (perCapitaBpc > limiteBpc) {
      alertasBpc.push(`Com o salário, a renda por pessoa (${formatarMoeda(perCapitaBpc)}, sem contar o BPC) passa do critério do BPC (${formatarMoeda(limiteBpc)}). A renda do trabalho pode afetar o benefício de quem recebe BPC na família — procure orientação no CRAS ou no INSS antes de decidir.`);
    } else {
      alertasBpc.push(`A renda por pessoa (${formatarMoeda(perCapitaBpc)}, sem contar o BPC) continua dentro do critério do BPC (${formatarMoeda(limiteBpc)}). Mesmo assim, atualize o CadÚnico e confirme no CRAS/INSS.`);
    }
  }

  // Direitos com o registro (valores anuais estimados, em valores de hoje)
  const s = e.salarioProposto;
  const inss13 = calcularInssEmpregado(s, tabela).valor;
  const decimoLiquido = somar(s, -inss13);
  const tercoFerias = arred(s / 3);
  const fgtsAno = arred(s * 0.08 * 12 + s * 0.08 + tercoFerias * 0.08);
  const direitos = [
    { titulo: "13º salário", valor: decimoLiquido, texto: `Um salário a mais por ano (cerca de ${formatarMoeda(decimoLiquido)} líquido).` },
    { titulo: "Férias + 1/3", valor: tercoFerias, texto: `30 dias de descanso pagos por ano, com 1/3 a mais (${formatarMoeda(tercoFerias)}).` },
    { titulo: "FGTS", valor: fgtsAno, texto: `O patrão deposita 8% todo mês numa conta em seu nome (cerca de ${formatarMoeda(fgtsAno)} por ano), mais 3,2% de indenização para o caso de demissão.` },
    { titulo: "Seguro-desemprego", valor: null, texto: `Se for demitida sem justa causa, recebe 3 parcelas de ${formatarMoeda(p.salarioMinimo)} (precisa ter trabalhado 15 meses nos últimos 24).` },
    { titulo: "Aposentadoria", valor: null, texto: "Cada mês trabalhado conta para a aposentadoria pelo INSS (12 contribuições por ano)." },
    { titulo: "Auxílio-doença", valor: null, texto: "Se ficar doente e não puder trabalhar, o INSS paga desde o primeiro dia de afastamento." },
    { titulo: "Licença-maternidade", valor: null, texto: "120 dias de licença com salário pago pelo INSS, e estabilidade desde a gravidez até 5 meses após o parto." },
    { titulo: "Proteção em acidente", valor: null, texto: "Em acidente de trabalho, tem auxílio do INSS e 12 meses de estabilidade ao voltar." },
  ];
  const deveres = [
    `Desconto do INSS no salário (${formatarMoeda(inss)} por mês com este salário).`,
    "Cumprir a jornada combinada e registrar o ponto todos os dias.",
    "Avisar o empregador quando faltar e apresentar atestado.",
    "Atualizar o CadÚnico informando o novo trabalho e a nova renda (é obrigatório e protege a família).",
  ];

  // Ganho em 12 meses e 5 anos (valores de hoje, sem reajustes)
  function acumulado(meses: number) {
    let sem = 0;
    let com = 0;
    for (let m = 1; m <= meses; m++) {
      sem += (empregada?.renda ?? 0) + bolsaSem.valorMensal;
      const bolsa = bolsaCom.situacao === "protecao" ? (m <= (bolsaCom.meses ?? 0) ? bolsaCom.valorMensal : 0) : bolsaCom.valorMensal;
      com += liquido + bolsa;
      if (m % 12 === 0) com += decimoLiquido + tercoFerias;
    }
    const anos = Math.floor(meses / 12);
    return { sem: arred(sem), com: arred(com), diferenca: arred(com - sem), fgts: arred(fgtsAno * anos) };
  }

  const notasBolsa = [
    "Famílias que já estavam na regra de proteção antes de junho de 2025 seguem as condições antigas (até 24 meses).",
    "Se o aumento de renda vier de aposentadoria, pensão ou BPC, a permanência na regra de proteção é menor. Confirme no CRAS.",
    "Quem sai do programa por aumento de renda pode voltar com prioridade se a renda cair (retorno garantido).",
  ];

  return {
    semCarteira,
    comCarteira,
    notasBolsa,
    estimativaBolsa: estimativa,
    valorBolsaUsado: valorBolsa,
    alertasBpc,
    direitos,
    deveres,
    inss,
    liquido,
    ganho12: acumulado(12),
    ganho60: acumulado(60),
    aviso: AVISO_BENEFICIOS,
  };
}

export type ResultadoBeneficiosSociais = ReturnType<typeof simularBeneficiosSociais>;
