import { data, diaUtilAnteriorOuIgual, proximaCompetencia, soData, ultimoDiaMes } from "./datas";
import { vencimentoDae } from "./regularizacao";

export const ETAPAS_CHECKLIST = [
  { campo: "infoRecebida", rotulo: "Informações do mês recebidas do cliente", curto: "Info recebida" },
  { campo: "folhaLancada", rotulo: "Folha lançada", curto: "Folha lançada" },
  { campo: "folhaEncerrada", rotulo: "Folha encerrada", curto: "Folha encerrada" },
  { campo: "daeEmitido", rotulo: "DAE emitido (valor e código)", curto: "DAE emitido" },
  { campo: "daeEnviado", rotulo: "DAE e recibo enviados ao cliente", curto: "Enviado" },
  { campo: "pagamentoConfirmado", rotulo: "Pagamento do DAE confirmado", curto: "Pago" },
  { campo: "reciboArquivado", rotulo: "Recibo assinado arquivado", curto: "Recibo arquivado" },
] as const;

export type CampoChecklist = (typeof ETAPAS_CHECKLIST)[number]["campo"];
export type EstadoChecklist = Partial<Record<CampoChecklist, boolean>>;

/**
 * Prazos de cada etapa (contrato de prestação de serviços):
 * cliente envia informações até o dia 30 (ou último dia) da competência;
 * consultor emite as guias até o dia 4 do mês seguinte;
 * DAE vence no dia 7 (ou dia útil anterior);
 * recibo assinado arquivado até o dia 15 do mês seguinte.
 */
export function prazosChecklist(ano: number, mes: number): Record<CampoChecklist, Date> {
  const ultimo = ultimoDiaMes(ano, mes);
  const info = data(ano, mes, Math.min(30, ultimo.getUTCDate()));
  const prox = proximaCompetencia(ano, mes);
  const emissao = diaUtilAnteriorOuIgual(data(prox.ano, prox.mes, 4));
  const venc = vencimentoDae(ano, mes);
  return {
    infoRecebida: info,
    folhaLancada: emissao,
    folhaEncerrada: emissao,
    daeEmitido: emissao,
    daeEnviado: emissao,
    pagamentoConfirmado: venc,
    reciboArquivado: data(prox.ano, prox.mes, 15),
  };
}

export interface SituacaoChecklist {
  concluidas: number;
  total: number;
  pendentes: CampoChecklist[];
  atrasadas: CampoChecklist[];
  completo: boolean;
  /** "ok" | "pendente" | "atrasado" */
  status: "ok" | "pendente" | "atrasado";
  vencimentoDae: Date;
}

export function situacaoChecklist(ano: number, mes: number, estado: EstadoChecklist, hoje: Date): SituacaoChecklist {
  const prazos = prazosChecklist(ano, mes);
  const h = soData(hoje).getTime();
  const pendentes = ETAPAS_CHECKLIST.filter((e) => !estado[e.campo]).map((e) => e.campo);
  const atrasadas = pendentes.filter((c) => prazos[c].getTime() < h);
  return {
    concluidas: ETAPAS_CHECKLIST.length - pendentes.length,
    total: ETAPAS_CHECKLIST.length,
    pendentes,
    atrasadas,
    completo: pendentes.length === 0,
    status: atrasadas.length ? "atrasado" : pendentes.length ? "pendente" : "ok",
    vencimentoDae: prazos.pagamentoConfirmado,
  };
}
