/** Orientações de lançamento no eSocial por tipo de afastamento. */
export const ORIENTACAO_AFASTAMENTO: Record<string, string> = {
  ATESTADO: "Atestado de até 15 dias: o empregador paga normalmente; lance como falta justificada.",
  LICENCA_MATERNIDADE: "Licença-maternidade de 120 dias, paga diretamente pelo INSS. No eSocial, informe o afastamento (motivo 17) e não lance salário no período.",
  AUXILIO_INCAPACIDADE: "No doméstico o INSS paga desde o 1º dia de afastamento. Informe o afastamento por doença no eSocial e não pague salário no período.",
  ACIDENTE_TRABALHO: "Emita a CAT no eSocial. O INSS paga o benefício; o empregado terá estabilidade de 12 meses após o retorno.",
  OUTRO: "Registre o motivo e confira o tratamento no eSocial.",
};
