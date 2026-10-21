import {
  addAnos,
  addDias,
  anosCompletos,
  data,
  diaUtilAnteriorOuIgual,
  diferencaDias,
  formatarCompetencia,
  formatarData,
  soData,
} from "./datas";
import { periodosFerias, type FeriasGozadas } from "./ferias";
import { vencimentoDae } from "./regularizacao";
import type { Severidade } from "./validacoes";

export type TipoEvento =
  | "DAE_MENSAL"
  | "DECIMO_PRIMEIRA"
  | "DECIMO_SEGUNDA"
  | "FERIAS_AQUISITIVO"
  | "FERIAS_CONCESSIVO"
  | "FERIAS_AVISO"
  | "FERIAS_PAGAMENTO"
  | "EXPERIENCIA_FIM"
  | "PROCURACAO"
  | "ANIVERSARIO_ADMISSAO"
  | "REAJUSTE_ANUAL"
  | "ESTABILIDADE_FIM"
  | "MENSALIDADE";

export const ROTULOS_EVENTO: Record<TipoEvento, string> = {
  DAE_MENSAL: "DAE mensal",
  DECIMO_PRIMEIRA: "13º — 1ª parcela",
  DECIMO_SEGUNDA: "13º — 2ª parcela e DAE",
  FERIAS_AQUISITIVO: "Férias — período aquisitivo",
  FERIAS_CONCESSIVO: "Férias — risco de dobro",
  FERIAS_AVISO: "Aviso de férias",
  FERIAS_PAGAMENTO: "Pagamento de férias",
  EXPERIENCIA_FIM: "Fim da experiência",
  PROCURACAO: "Procuração eletrônica",
  ANIVERSARIO_ADMISSAO: "Aniversário de admissão",
  REAJUSTE_ANUAL: "Reajuste anual",
  ESTABILIDADE_FIM: "Fim de estabilidade",
  MENSALIDADE: "Mensalidade",
};

export interface Evento {
  chave: string;
  data: Date;
  tipo: TipoEvento;
  titulo: string;
  descricao: string;
  severidade: Severidade;
  clienteId?: string;
  empregadoId?: string;
}

export interface ClienteAgenda {
  id: string;
  nome: string;
  procuracaoValidade?: Date | null;
  temEmpregadoAtivo: boolean;
}

export interface EmpregadoAgenda {
  id: string;
  nome: string;
  clienteId: string;
  clienteNome: string;
  admissao: Date;
  ativo: boolean;
  diasExperiencia?: number | null;
  feriasGozadas: FeriasGozadas[];
  feriasProgramadas?: { inicio: Date; dias: number }[];
  estabilidadeAte?: Date | null;
  estabilidadeMotivo?: string | null;
}

function severidadePorPrazo(hoje: Date, quando: Date, critico = 0, aviso = 7): Severidade {
  const dias = diferencaDias(hoje, quando);
  if (dias < critico) return "critico";
  if (dias <= aviso) return "aviso";
  return "info";
}

/** Gera a agenda de vencimentos e alertas entre `de` e `ate`. */
export function gerarAgenda(opcoes: {
  hoje: Date;
  de: Date;
  ate: Date;
  clientes: ClienteAgenda[];
  empregados: EmpregadoAgenda[];
}): Evento[] {
  const { hoje, clientes, empregados } = opcoes;
  const de = soData(opcoes.de);
  const ate = soData(opcoes.ate);
  const dentro = (d: Date) => d.getTime() >= de.getTime() && d.getTime() <= ate.getTime();
  const eventos: Evento[] = [];
  const add = (ev: Evento) => {
    if (dentro(ev.data)) eventos.push(ev);
  };

  // Vencimentos gerais por ano no intervalo
  for (let ano = de.getUTCFullYear(); ano <= ate.getUTCFullYear(); ano++) {
    for (let mes = 1; mes <= 12; mes++) {
      const venc = vencimentoDae(ano, mes);
      if (!dentro(venc)) continue;
      for (const c of clientes.filter((c) => c.temEmpregadoAtivo)) {
        add({
          chave: `dae-${c.id}-${ano}-${mes}`,
          data: venc,
          tipo: "DAE_MENSAL",
          titulo: `DAE ${formatarCompetencia(ano, mes)} — ${c.nome}`,
          descricao: `Vencimento do DAE da competência ${formatarCompetencia(ano, mes)}. Emitir até o dia 4.`,
          severidade: severidadePorPrazo(hoje, venc, 0, 5),
          clienteId: c.id,
        });
      }
    }
    const p1 = diaUtilAnteriorOuIgual(data(ano, 11, 30));
    const p2 = diaUtilAnteriorOuIgual(data(ano, 12, 20));
    for (const c of clientes.filter((c) => c.temEmpregadoAtivo)) {
      add({ chave: `13a-${c.id}-${ano}`, data: p1, tipo: "DECIMO_PRIMEIRA", titulo: `1ª parcela do 13º — ${c.nome}`, descricao: "Pagar a 1ª parcela do 13º salário (sem desconto de INSS).", severidade: severidadePorPrazo(hoje, p1, 0, 15), clienteId: c.id });
      add({ chave: `13b-${c.id}-${ano}`, data: p2, tipo: "DECIMO_SEGUNDA", titulo: `2ª parcela e DAE do 13º — ${c.nome}`, descricao: "Pagar a 2ª parcela do 13º e o DAE do 13º.", severidade: severidadePorPrazo(hoje, p2, 0, 15), clienteId: c.id });
    }
    add({
      chave: `reajuste-${ano}`,
      data: data(ano, 1, 2),
      tipo: "REAJUSTE_ANUAL",
      titulo: `Reajuste do salário mínimo ${ano}`,
      descricao: "Atualize a tabela anual (salário mínimo, INSS e salário-família) e revise salários abaixo do mínimo proporcional.",
      severidade: "aviso",
    });
  }

  for (const c of clientes) {
    if (!c.procuracaoValidade) continue;
    const v = soData(c.procuracaoValidade);
    add({ chave: `proc-aviso-${c.id}`, data: addDias(v, -30), tipo: "PROCURACAO", titulo: `Procuração vence em 30 dias — ${c.nome}`, descricao: `A procuração eletrônica vence em ${formatarData(v)}. Peça a renovação.`, severidade: severidadePorPrazo(hoje, v, 0, 30), clienteId: c.id });
    add({ chave: `proc-${c.id}`, data: v, tipo: "PROCURACAO", titulo: `Procuração vence hoje — ${c.nome}`, descricao: "Sem procuração ativa não é possível acessar o eSocial do cliente.", severidade: severidadePorPrazo(hoje, v, 0, 30), clienteId: c.id });
  }

  for (const e of empregados.filter((x) => x.ativo)) {
    const base = { clienteId: e.clienteId, empregadoId: e.id };
    const nome = `${e.nome} (${e.clienteNome})`;

    if (e.diasExperiencia) {
      const fim = addDias(soData(e.admissao), e.diasExperiencia - 1);
      add({ ...base, chave: `exp-${e.id}`, data: fim, tipo: "EXPERIENCIA_FIM", titulo: `Fim da experiência — ${nome}`, descricao: "Último dia do contrato de experiência. Se continuar trabalhando, passa a prazo indeterminado.", severidade: severidadePorPrazo(hoje, fim, 0, 10) });
    }

    for (let ano = de.getUTCFullYear(); ano <= ate.getUTCFullYear(); ano++) {
      const aniv = data(ano, e.admissao.getUTCMonth() + 1, Math.min(e.admissao.getUTCDate(), 28));
      const anos = anosCompletos(e.admissao, aniv);
      if (anos >= 1) {
        add({ ...base, chave: `aniv-${e.id}-${ano}`, data: aniv, tipo: "ANIVERSARIO_ADMISSAO", titulo: `${anos} ano(s) de casa — ${nome}`, descricao: `Aviso prévio passa a ${Math.min(90, 30 + 3 * anos)} dias (+3 por ano completo).`, severidade: "info" });
      }
    }

    const periodos = periodosFerias(e.admissao, addAnos(ate, 1), e.feriasGozadas);
    for (const p of periodos) {
      if (p.status === "GOZADO") continue;
      const avisoAquisitivo = addDias(p.fimAquisitivo, -60);
      add({ ...base, chave: `fer-aq-${e.id}-${p.numero}`, data: avisoAquisitivo, tipo: "FERIAS_AQUISITIVO", titulo: `Período aquisitivo completa em 60 dias — ${nome}`, descricao: `O ${p.numero}º período aquisitivo termina em ${formatarData(p.fimAquisitivo)}. Comece a planejar as férias.`, severidade: "info" });
      const alertaConcessivo = addDias(p.fimConcessivo, -60);
      add({ ...base, chave: `fer-conc-${e.id}-${p.numero}`, data: alertaConcessivo, tipo: "FERIAS_CONCESSIVO", titulo: `Férias vencem em 60 dias — ${nome}`, descricao: `O período concessivo termina em ${formatarData(p.fimConcessivo)}. Depois disso as férias são pagas em dobro.`, severidade: "critico" });
    }

    for (const f of e.feriasProgramadas ?? []) {
      const ini = soData(f.inicio);
      add({ ...base, chave: `fer-aviso-${e.id}-${ini.getTime()}`, data: addDias(ini, -30), tipo: "FERIAS_AVISO", titulo: `Avisar férias — ${nome}`, descricao: `Entregar o aviso de férias (início em ${formatarData(ini)}, ${f.dias} dias).`, severidade: severidadePorPrazo(hoje, addDias(ini, -30), 0, 5) });
      add({ ...base, chave: `fer-pag-${e.id}-${ini.getTime()}`, data: addDias(ini, -2), tipo: "FERIAS_PAGAMENTO", titulo: `Pagar férias — ${nome}`, descricao: `Pagamento das férias + 1/3 até 2 dias antes do início (${formatarData(ini)}).`, severidade: severidadePorPrazo(hoje, addDias(ini, -2), 0, 5) });
    }

    if (e.estabilidadeAte) {
      add({ ...base, chave: `estab-${e.id}`, data: soData(e.estabilidadeAte), tipo: "ESTABILIDADE_FIM", titulo: `Fim da estabilidade — ${nome}`, descricao: `Estabilidade (${e.estabilidadeMotivo ?? "provisória"}) termina nesta data.`, severidade: "info" });
    }
  }

  return eventos.sort((a, b) => a.data.getTime() - b.data.getTime() || a.titulo.localeCompare(b.titulo));
}
