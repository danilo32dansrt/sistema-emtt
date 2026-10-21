import type { TabelaAnual } from "@/lib/calculos";

/** Dados do empregado enviados do servidor para as calculadoras (somente tipos simples). */
export interface EmpregadoCalc {
  id: string;
  nome: string;
  cliente: string;
  salario: number;
  horasSemanais: number;
  regime: "INTEGRAL" | "PARCIAL" | "DOZE_X_TRINTA_SEIS";
  admissao: string;
  desligamento: string | null;
  dependentes: number;
  valeTransporte: number;
  diasExperiencia: number | null;
  estabilidadeAte: string | null;
  estabilidadeMotivo: string | null;
  feriasGozadas: { inicioAquisitivo: string; dias: number }[];
}

export interface PropsCalculadora {
  tabelas: TabelaAnual[];
  empregados: EmpregadoCalc[];
  inicial?: { empregadoId?: string; ano?: number; mes?: number; aba?: string };
  regraFeriasParcial: "CLT" | "LC150";
  selicMensal: number;
  hoje: string;
}
