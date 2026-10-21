import type { ParametrosJornada } from "./parametros";
import { LIMITES_JORNADA_PADRAO } from "./parametros-padrao";
import { addDias, diferencaDias, idade, soData } from "./datas";
import { formatarMoeda } from "./dinheiro";
import {
  type JornadaSemanal,
  type Regime,
  diasTrabalhadosPorSemana,
  horasSemanaisDaJornada,
  maiorJornadaDiaria,
  salarioMinimoProporcional,
} from "./salario";

export function somenteDigitos(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

export function cpfValido(cpf: string): boolean {
  const c = somenteDigitos(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(c.slice(0, 9), 10) === Number(c[9]) && dv(c.slice(0, 10), 11) === Number(c[10]);
}

export function formatarCpf(cpf: string): string {
  const c = somenteDigitos(cpf).padStart(11, "0");
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

/** CPF mascarado para listagens (LGPD): ***.456.789-** */
export function mascararCpf(cpf: string | null | undefined): string {
  if (!cpf) return "";
  const c = somenteDigitos(cpf);
  if (c.length !== 11) return "***";
  return `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**`;
}

export function formatarTelefone(tel: string | null | undefined): string {
  const t = somenteDigitos(tel ?? "");
  if (t.length === 11) return `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`;
  if (t.length === 10) return `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;
  return tel ?? "";
}

export type Severidade = "info" | "aviso" | "critico";

export interface AlertaValidacao {
  codigo: string;
  severidade: Severidade;
  mensagem: string;
}

export interface DadosValidacaoEmpregado {
  salario: number;
  regime: Regime;
  jornada: JornadaSemanal;
  admissao: Date;
  nascimento?: Date | null;
  cpf?: string;
  salarioMinimo: number;
  diasExperiencia?: number | null;
  acordoEscrito12x36?: boolean;
  acordoCompensacao?: boolean;
  hoje?: Date;
  /** Limites legais vigentes (tabela de parâmetros). */
  limites?: ParametrosJornada;
}

/** Validações obrigatórias do cadastro de empregado (seção 2.2). */
export function validarEmpregado(d: DadosValidacaoEmpregado): AlertaValidacao[] {
  const alertas: AlertaValidacao[] = [];
  const semanais = horasSemanaisDaJornada(d.jornada);
  const diaria = maiorJornadaDiaria(d.jornada);
  const dias = diasTrabalhadosPorSemana(d.jornada);
  const hoje = d.hoje ?? new Date();
  const L = d.limites ?? LIMITES_JORNADA_PADRAO;

  if (d.cpf !== undefined && !cpfValido(d.cpf)) {
    alertas.push({ codigo: "CPF_INVALIDO", severidade: "critico", mensagem: "CPF inválido." });
  }

  const minimo = salarioMinimoProporcional(d.salarioMinimo, d.regime === "DOZE_X_TRINTA_SEIS" ? 44 : semanais);
  if (d.salario + 0.004 < minimo) {
    alertas.push({
      codigo: "SALARIO_ABAIXO_MINIMO",
      severidade: "critico",
      mensagem: `Salário ${formatarMoeda(d.salario)} abaixo do mínimo proporcional de ${formatarMoeda(minimo)} para ${semanais}h semanais (mínimo ÷ 220 × ${semanais} × 5).`,
    });
  }

  if (dias > 0 && dias <= 2) {
    alertas.push({
      codigo: "DIARISTA",
      severidade: "aviso",
      mensagem: `Trabalho em ${dias} dia(s) por semana caracteriza diarista (sem vínculo de emprego doméstico — LC 150, art. 1º).`,
    });
  }

  if (d.regime === "PARCIAL") {
    if (semanais > L.parcialSemanalMax) alertas.push({ codigo: "PARCIAL_SEMANAL", severidade: "critico", mensagem: `Jornada parcial de ${semanais}h passa do limite de ${L.parcialSemanalMax}h semanais (LC 150, art. 3º).` });
    if (diaria > L.parcialDiariaMax) alertas.push({ codigo: "PARCIAL_DIARIA", severidade: "critico", mensagem: `Jornada parcial com ${diaria}h em um dia; o limite é ${L.parcialDiariaMax}h diárias (LC 150, art. 3º, § 2º).` });
  }
  if (d.regime === "INTEGRAL") {
    if (semanais > 44) alertas.push({ codigo: "INTEGRAL_SEMANAL", severidade: "critico", mensagem: `Jornada de ${semanais}h passa de 44h semanais (LC 150, art. 2º).` });
    if (diaria > 8 && !d.acordoCompensacao) alertas.push({ codigo: "INTEGRAL_DIARIA", severidade: "aviso", mensagem: `Jornada de ${diaria}h em um dia passa de 8h; só é permitida com acordo de compensação escrito.` });
    if (diaria > L.limiteDiario) alertas.push({ codigo: "INTEGRAL_DIARIA_MAX", severidade: "critico", mensagem: `Jornada de ${diaria}h em um dia passa do limite de ${L.limiteDiario}h (8h + 2h extras).` });
    if (semanais > 0 && semanais <= L.parcialSemanalMax) alertas.push({ codigo: "INTEGRAL_COM_JORNADA_PARCIAL", severidade: "info", mensagem: `Jornada de até ${L.parcialSemanalMax}h: avalie cadastrar como tempo parcial.` });
  }
  if (d.regime === "DOZE_X_TRINTA_SEIS" && !d.acordoEscrito12x36) {
    alertas.push({ codigo: "SEM_ACORDO_12X36", severidade: "critico", mensagem: "Escala 12x36 exige acordo escrito entre as partes (LC 150, art. 10)." });
  }

  if (d.nascimento) {
    const anos = idade(d.nascimento, d.admissao);
    if (anos < 18) alertas.push({ codigo: "MENOR_DE_IDADE", severidade: "critico", mensagem: "É proibida a contratação de menor de 18 anos para trabalho doméstico (LC 150, art. 1º, parágrafo único)." });
  }

  if (d.diasExperiencia) {
    if (d.diasExperiencia > 90) {
      alertas.push({ codigo: "EXPERIENCIA_LONGA", severidade: "critico", mensagem: "Contrato de experiência não pode passar de 90 dias (LC 150, art. 5º)." });
    } else {
      const fim = addDias(soData(d.admissao), d.diasExperiencia - 1);
      const faltam = diferencaDias(soData(hoje), fim);
      if (faltam >= 0 && faltam <= 10) {
        alertas.push({ codigo: "EXPERIENCIA_ACABANDO", severidade: "aviso", mensagem: `Contrato de experiência termina em ${faltam} dia(s). Decida se o contrato continua.` });
      }
    }
  }
  return alertas;
}
