import "server-only";
import {
  addDias, calcularDecimoTerceiro, calcularFerias, calcularFolhaMensal, diasAvisoPrevio, formatarCompetencia, formatarData, formatarMoeda, formatarNumero,
  minutosParaHora, periodosFerias, soData,
} from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { salvarBytes, sha256 } from "@/lib/arquivos";
import * as pdf from "@/lib/pdf/documentos";
import { espelhoDoMes } from "./ponto";
import { folhaDoMes } from "./folha";
import { configuracao, tabelaDoAno } from "@/lib/tabelas-db";

export const TIPOS_DOCUMENTO = {
  CONTRATO_TRABALHO: { rotulo: "Contrato de trabalho", empregado: true, assinaEmpregado: true },
  ACORDO_COMPENSACAO: { rotulo: "Acordo de compensação (banco de horas)", empregado: true, assinaEmpregado: true },
  ACORDO_12X36: { rotulo: "Acordo de 12x36", empregado: true, assinaEmpregado: true },
  ACORDO_INTERVALO: { rotulo: "Acordo de intervalo de 30 minutos", empregado: true, assinaEmpregado: true },
  ACORDO_VIAGEM: { rotulo: "Acordo de acompanhamento em viagem", empregado: true, assinaEmpregado: true },
  FOLHA_PONTO: { rotulo: "Folha de ponto manual (para assinatura)", empregado: true, assinaEmpregado: false },
  ESPELHO_PONTO: { rotulo: "Espelho de ponto do mês", empregado: true, assinaEmpregado: true },
  RECIBO_SALARIO: { rotulo: "Recibo de salário (holerite)", empregado: true, assinaEmpregado: true },
  RECIBO_ADIANTAMENTO: { rotulo: "Recibo de adiantamento", empregado: true, assinaEmpregado: true },
  AVISO_FERIAS: { rotulo: "Aviso de férias", empregado: true, assinaEmpregado: true },
  RECIBO_FERIAS: { rotulo: "Recibo de férias", empregado: true, assinaEmpregado: true },
  RECIBO_13: { rotulo: "Recibo de 13º salário", empregado: true, assinaEmpregado: true },
  AVISO_PREVIO: { rotulo: "Aviso prévio", empregado: true, assinaEmpregado: true },
  INFORME_RENDIMENTOS: { rotulo: "Informe anual de rendimentos", empregado: true, assinaEmpregado: false },
  CONTRATO_SERVICO: { rotulo: "Contrato de prestação de serviços (consultoria)", empregado: false, assinaEmpregado: false },
} as const;

export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;

export interface ParametrosDocumento {
  tipo: TipoDocumento;
  clienteId: string;
  empregadoId?: string | null;
  ano?: number;
  mes?: number;
  feriasId?: string;
  parcela?: 1 | 2;
  valor?: number;
  data?: Date;
  quem?: "EMPREGADOR" | "EMPREGADO";
  modoAviso?: "TRABALHADO" | "INDENIZADO" | "DISPENSADO";
}

/** Gera o PDF, guarda o arquivo e cria o Documento (pronto para assinatura eletrônica). */
export async function gerarDocumento(p: ParametrosDocumento, usuarioId: string) {
  const config = await configuracao();
  const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: p.clienteId } });
  const empregado = p.empregadoId ? await prisma.empregado.findUniqueOrThrow({ where: { id: p.empregadoId }, include: { ferias: true } }) : null;
  if (empregado && empregado.clienteId !== cliente.id) throw new Error("Empregado não pertence ao cliente.");
  if (TIPOS_DOCUMENTO[p.tipo].empregado && !empregado) throw new Error("Escolha o empregado.");
  const partes = { config, cliente, empregado };
  const comp = p.ano && p.mes ? formatarCompetencia(p.ano, p.mes) : null;
  let bytes: Uint8Array;
  let titulo: string = TIPOS_DOCUMENTO[p.tipo].rotulo;
  let espelho: { ano: number; mes: number; resumo: unknown } | null = null;

  switch (p.tipo) {
    case "CONTRATO_TRABALHO":
      bytes = await pdf.contratoTrabalho(partes);
      break;
    case "ACORDO_COMPENSACAO":
    case "ACORDO_12X36":
    case "ACORDO_INTERVALO":
    case "ACORDO_VIAGEM":
      bytes = await pdf.acordo(partes, ({ ACORDO_COMPENSACAO: "COMPENSACAO", ACORDO_12X36: "12X36", ACORDO_INTERVALO: "INTERVALO", ACORDO_VIAGEM: "VIAGEM" } as const)[p.tipo]);
      break;
    case "CONTRATO_SERVICO":
      bytes = await pdf.contratoServico(partes);
      break;
    case "FOLHA_PONTO":
      if (!p.ano || !p.mes) throw new Error("Informe o mês.");
      bytes = await pdf.folhaPontoManual(partes, p.ano, p.mes);
      titulo += ` ${comp}`;
      break;
    case "ESPELHO_PONTO": {
      if (!p.ano || !p.mes) throw new Error("Informe o mês.");
      const esp = await espelhoDoMes(empregado!, p.ano, p.mes);
      const resumo = [
        { rotulo: "Horas previstas", valor: `${formatarNumero(esp.horas.previsto)} h` },
        { rotulo: "Horas trabalhadas", valor: `${formatarNumero(esp.horas.trabalhado)} h` },
        { rotulo: "Horas extras 50% a pagar", valor: `${formatarNumero(esp.horas.extras50)} h (${formatarMoeda(esp.valores.horasExtras50)})` },
        { rotulo: "Horas extras 100%", valor: `${formatarNumero(esp.horas.extras100)} h (${formatarMoeda(esp.valores.horasExtras100)})` },
        { rotulo: "Horas noturnas (convertidas)", valor: `${formatarNumero(esp.horas.noturno)} h (adicional ${formatarMoeda(esp.valores.adicionalNoturno)})` },
        { rotulo: "Banco de horas no mês", valor: `${formatarNumero(esp.horas.banco)} h` },
        { rotulo: "Faltas injustificadas", valor: `${esp.resumo.faltas} dia(s), ${esp.resumo.semanasComFalta} semana(s) com perda de DSR` },
        { rotulo: "Atrasos descontados", valor: minutosParaHora(esp.resumo.atrasoDescontado) },
        { rotulo: "Faltas justificadas", valor: `${esp.resumo.faltasJustificadas} dia(s)` },
      ];
      bytes = await pdf.espelhoPonto(partes, p.ano, p.mes, esp.dias, resumo, esp.marcacoes.map((m) => ({ nsr: m.nsr, tipo: m.tipo, dataHora: m.dataHora, origem: m.origem })));
      titulo += ` ${comp}`;
      espelho = { ano: p.ano, mes: p.mes, resumo: { horas: esp.horas, valores: esp.valores, faltas: esp.resumo.faltas } };
      break;
    }
    case "RECIBO_SALARIO": {
      if (!p.ano || !p.mes) throw new Error("Informe o mês.");
      const l = await prisma.lancamentoMensal.findUnique({ where: { empregadoId_ano_mes: { empregadoId: empregado!.id, ano: p.ano, mes: p.mes } } });
      const { folha } = await folhaDoMes(empregado!, p.ano, p.mes, l);
      bytes = await pdf.reciboComMemoria(partes, `Recibo de salário ${comp}`, `Pagamento referente à competência ${comp}.`, folha.memoria.linhas, folha.liquido);
      titulo += ` ${comp}`;
      break;
    }
    case "RECIBO_ADIANTAMENTO":
      if (!p.valor || !p.data) throw new Error("Informe valor e data.");
      bytes = await pdf.reciboAdiantamento(partes, p.valor, p.data, comp ?? formatarCompetencia(p.data.getUTCFullYear(), p.data.getUTCMonth() + 1));
      titulo += ` ${formatarData(p.data)}`;
      break;
    case "AVISO_FERIAS":
    case "RECIBO_FERIAS": {
      const f = empregado!.ferias.find((x) => x.id === p.feriasId);
      if (!f) throw new Error("Escolha as férias registradas.");
      const per = periodosFerias(empregado!.admissao, addDias(f.inicioAquisitivo, 370)).find((x) => x.inicioAquisitivo.getTime() === soData(f.inicioAquisitivo).getTime());
      const fim = addDias(f.inicioGozo, f.dias - 1);
      if (p.tipo === "AVISO_FERIAS") {
        bytes = await pdf.avisoFerias(partes, { inicioAquisitivo: f.inicioAquisitivo, fimAquisitivo: per?.fimAquisitivo ?? addDias(f.inicioAquisitivo, 364), inicio: f.inicioGozo, dias: f.dias, abono: f.diasAbono, retorno: addDias(fim, 1), pagamento: addDias(f.inicioGozo, -2) });
      } else {
        const { tabela } = await tabelaDoAno(f.inicioGozo.getUTCFullYear());
        const emDobro = per ? f.inicioGozo > per.fimConcessivo : false;
        const r = calcularFerias({ salario: num(empregado!.salario), diasGozo: f.dias, diasAbono: f.diasAbono, inicioGozo: f.inicioGozo, emDobro, tabela });
        bytes = await pdf.reciboComMemoria(partes, "Recibo de férias", `Férias de ${f.dias} dias, de ${formatarData(f.inicioGozo)} a ${formatarData(fim)}${f.diasAbono ? `, com ${f.diasAbono} dias de abono pecuniário` : ""}.`, r.memoria.linhas, r.liquido);
      }
      titulo += ` ${formatarData(f.inicioGozo)}`;
      break;
    }
    case "RECIBO_13": {
      const ano = p.ano ?? new Date().getUTCFullYear();
      const { tabela } = await tabelaDoAno(ano);
      const r = calcularDecimoTerceiro({ ano, salario: num(empregado!.salario), admissao: empregado!.admissao, desligamento: empregado!.desligamento, tabela });
      const parcela = p.parcela ?? 1;
      const linhas = parcela === 1
        ? [{ descricao: "(+) 1ª parcela do 13º salário", valor: r.primeiraParcela, formula: `${r.avos}/12 ÷ 2` }]
        : [
            { descricao: "(+) 13º salário integral", valor: r.total, formula: `${r.avos}/12` },
            { descricao: "(−) 1ª parcela já paga", valor: -r.primeiraParcela },
            { descricao: "(−) INSS sobre o 13º", valor: -r.inss },
          ];
      bytes = await pdf.reciboComMemoria(partes, `Recibo de 13º salário — ${parcela}ª parcela ${ano}`, `Pagamento da ${parcela}ª parcela do 13º salário de ${ano}.`, linhas, parcela === 1 ? r.primeiraParcela : r.segundaParcela);
      titulo += ` ${parcela}ª parcela ${ano}`;
      break;
    }
    case "AVISO_PREVIO": {
      const data = p.data ?? new Date();
      const quem = p.quem ?? "EMPREGADOR";
      bytes = await pdf.avisoPrevio(partes, { quem, data, dias: quem === "EMPREGADOR" ? diasAvisoPrevio(empregado!.admissao, data) : 30, modo: p.modoAviso ?? "TRABALHADO" });
      titulo += ` (${quem === "EMPREGADOR" ? "empregador" : "empregado"}) ${formatarData(data)}`;
      break;
    }
    case "INFORME_RENDIMENTOS": {
      const ano = p.ano ?? new Date().getUTCFullYear() - 1;
      const lancs = await prisma.lancamentoMensal.findMany({ where: { empregadoId: empregado!.id, ano } });
      const { tabela } = await tabelaDoAno(ano);
      let rendimentos = 0;
      let inss = 0;
      let salarioFamilia = 0;
      for (let mes = 1; mes <= 12; mes++) {
        const l = lancs.find((x) => x.mes === mes);
        const f = calcularFolhaMensal({ ano, mes, salario: num(empregado!.salario), horasSemanais: num(empregado!.horasSemanais), admissao: empregado!.admissao, desligamento: empregado!.desligamento, tabela, faltasInjustificadas: l?.faltasInjustificadas, semanasComFalta: l?.semanasComFalta, horasExtras50: num(l?.horasExtras50), horasExtras100: num(l?.horasExtras100), horasNoturnas: num(l?.horasNoturnas), dependentesSalarioFamilia: empregado!.dependentesSalarioFamilia });
        rendimentos += f.baseInss;
        inss += f.encargos.inssEmpregado;
        salarioFamilia += f.salarioFamilia;
      }
      const d13 = calcularDecimoTerceiro({ ano, salario: num(empregado!.salario), admissao: empregado!.admissao, desligamento: empregado!.desligamento, tabela });
      bytes = await pdf.informeRendimentos(partes, ano, { rendimentos, inss, decimoTerceiro: d13.total, inss13: d13.inss, salarioFamilia });
      titulo += ` ${ano}`;
      break;
    }
    default:
      throw new Error("Tipo de documento inválido.");
  }

  const nome = `${titulo} - ${empregado?.nome ?? cliente.nome}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
  const arquivo = await salvarBytes(bytes, { nome, mime: "application/pdf", clienteId: cliente.id, criadoPorId: usuarioId });
  const documento = await prisma.documento.create({
    data: {
      clienteId: cliente.id,
      empregadoId: empregado?.id ?? null,
      tipo: p.tipo,
      titulo,
      arquivoId: arquivo.id,
      hash: sha256(bytes),
      competencia: comp,
      exigeAssinaturaEmpregado: TIPOS_DOCUMENTO[p.tipo].assinaEmpregado,
      exigeAssinaturaCliente: p.tipo !== "FOLHA_PONTO" && p.tipo !== "INFORME_RENDIMENTOS",
      visivelEmpregado: Boolean(empregado) && p.tipo !== "CONTRATO_SERVICO",
      criadoPorId: usuarioId,
    },
  });
  if (espelho) {
    await prisma.espelhoPonto.upsert({
      where: { empregadoId_ano_mes: { empregadoId: empregado!.id, ano: espelho.ano, mes: espelho.mes } },
      create: { empregadoId: empregado!.id, ano: espelho.ano, mes: espelho.mes, resumo: espelho.resumo as object, hash: documento.hash, documentoId: documento.id },
      update: { resumo: espelho.resumo as object, hash: documento.hash, documentoId: documento.id, geradoEm: new Date(), assinadoEmpregadoEm: null, assinadoEmpregadorEm: null },
    });
  }
  return documento;
}
