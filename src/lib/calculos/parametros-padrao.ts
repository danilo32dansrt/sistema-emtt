import { data } from "./datas";
import type { ParametrosJornada, RegistroParametro } from "./parametros";
import { TABELAS_PADRAO } from "./tabelas";

/** Limites de jornada e banco de horas da LC 150 (valores iniciais; no sistema vêm da tabela de parâmetros). */
export const LIMITES_JORNADA_PADRAO: ParametrosJornada = {
  parcialSemanalMax: 25,
  parcialDiariaMax: 6,
  parcialExtraDiaria: 1,
  limiteDiario: 10,
  doze36Max: 12,
  bancoHorasPagasMes: 40,
  bancoHorasPrazoMeses: 12,
};

/**
 * Valores iniciais (carga do banco e testes). No sistema, tudo é editável na tela
 * "Parâmetros legais", com fonte oficial e data de conferência.
 * Confira sempre no gov.br antes de usar com clientes — principalmente Bolsa Família e BPC.
 */
export const PARAMETROS_PADRAO: (RegistroParametro & { fonte?: string; observacao?: string })[] = [
  ...Object.values(TABELAS_PADRAO).flatMap((t) => {
    const ini = data(t.ano, 1, 1);
    return [
      { chave: "SALARIO_MINIMO", valor: t.salarioMinimo, vigenciaInicio: ini },
      { chave: "INSS_FAIXAS", valor: t.faixasInss, vigenciaInicio: ini },
      { chave: "SALARIO_FAMILIA_LIMITE", valor: t.salarioFamiliaLimite, vigenciaInicio: ini },
      { chave: "SALARIO_FAMILIA_COTA", valor: t.salarioFamiliaCota, vigenciaInicio: ini },
    ];
  }),
  { chave: "INSS_PATRONAL", valor: 8, vigenciaInicio: data(2015, 10, 1) },
  { chave: "GILRAT", valor: 0.8, vigenciaInicio: data(2015, 10, 1) },
  { chave: "FGTS", valor: 8, vigenciaInicio: data(2015, 10, 1) },
  { chave: "FGTS_COMPENSATORIO", valor: 3.2, vigenciaInicio: data(2015, 10, 1) },
  { chave: "DAE_ARREDONDAMENTO", valor: "truncar", vigenciaInicio: data(2015, 10, 1), observacao: "Conferido com DAE real de fev/2026 (R$ 159,18)." },
  { chave: "DAE_MULTA_DIARIA", valor: 0.33, vigenciaInicio: data(1997, 1, 1) },
  { chave: "DAE_MULTA_MAXIMA", valor: 20, vigenciaInicio: data(1997, 1, 1) },
  { chave: "DAE_SELIC_MENSAL", valor: 1, vigenciaInicio: data(2024, 1, 1), observacao: "Estimativa; atualize com a taxa divulgada pela Receita." },
  { chave: "DAE_JUROS_MES_PAGAMENTO", valor: 1, vigenciaInicio: data(1997, 1, 1) },
  { chave: "BF_LINHA_POBREZA", valor: 218, vigenciaInicio: data(2023, 3, 1) },
  { chave: "BF_RENDA_CIDADANIA", valor: 142, vigenciaInicio: data(2023, 3, 1) },
  { chave: "BF_MINIMO_FAMILIA", valor: 600, vigenciaInicio: data(2023, 3, 1) },
  { chave: "BF_PRIMEIRA_INFANCIA", valor: 150, vigenciaInicio: data(2023, 3, 1) },
  { chave: "BF_VARIAVEL_FAMILIAR", valor: 50, vigenciaInicio: data(2023, 6, 1) },
  { chave: "BF_PROTECAO_PERCENTUAL", valor: 50, vigenciaInicio: data(2023, 3, 1) },
  { chave: "BF_PROTECAO_MESES", valor: 24, vigenciaInicio: data(2023, 3, 1), observacao: "Regra original da Lei 14.601/2023." },
  { chave: "BF_PROTECAO_MESES", valor: 12, vigenciaInicio: data(2025, 6, 1), observacao: "Portaria MDS nº 1.084/2025: 12 meses para quem entra na regra a partir de jun/2025 (quem já estava segue com até 24)." },
  // Regra de proteção: meio salário mínimo até mai/2025; teto fixo de R$ 706 a partir de jun/2025 (Portaria MDS nº 1.084/2025)
  { chave: "BF_PROTECAO_LIMITE", valor: 706, vigenciaInicio: data(2024, 1, 1), observacao: "Meio salário mínimo de 2024." },
  { chave: "BF_PROTECAO_LIMITE", valor: 759, vigenciaInicio: data(2025, 1, 1), observacao: "Meio salário mínimo de 2025." },
  { chave: "BF_PROTECAO_LIMITE", valor: 706, vigenciaInicio: data(2025, 6, 1), observacao: "Portaria MDS nº 1.084/2025: teto fixo de R$ 706 por pessoa." },
  { chave: "BPC_FRACAO_SM", valor: 0.25, vigenciaInicio: data(1993, 12, 7) },
  { chave: "JORNADA_PARCIAL_SEMANAL_MAX", valor: LIMITES_JORNADA_PADRAO.parcialSemanalMax, vigenciaInicio: data(2015, 6, 2) },
  { chave: "JORNADA_PARCIAL_DIARIA_MAX", valor: LIMITES_JORNADA_PADRAO.parcialDiariaMax, vigenciaInicio: data(2015, 6, 2) },
  { chave: "JORNADA_PARCIAL_EXTRA_DIARIA", valor: LIMITES_JORNADA_PADRAO.parcialExtraDiaria, vigenciaInicio: data(2015, 6, 2) },
  { chave: "JORNADA_LIMITE_DIARIO", valor: LIMITES_JORNADA_PADRAO.limiteDiario, vigenciaInicio: data(2015, 6, 2) },
  { chave: "JORNADA_12X36_MAX", valor: LIMITES_JORNADA_PADRAO.doze36Max, vigenciaInicio: data(2015, 6, 2) },
  { chave: "BANCO_HORAS_PAGAS_MES", valor: LIMITES_JORNADA_PADRAO.bancoHorasPagasMes, vigenciaInicio: data(2015, 6, 2) },
  { chave: "BANCO_HORAS_PRAZO_MESES", valor: LIMITES_JORNADA_PADRAO.bancoHorasPrazoMeses, vigenciaInicio: data(2015, 6, 2) },
];
