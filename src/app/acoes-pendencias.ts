"use server";

import { revalidatePath } from "next/cache";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { usuarioAtual, type UsuarioLogado } from "@/lib/auth/sessao";
import {
  DIAS_SEMANA, diaSemana, formatarCompetencia, formatarData, formatarMoeda, hojeBrasil, instantesDoDia, lerData, lerMoeda, marcacoesDoContrato,
} from "@/lib/calculos";
import { horariosDoEmpregado, jornadaDoEmpregado } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { avisarEmpregada, avisarPatroes } from "@/lib/notificacoes";
import { fecharMesPeloPonto, resumoDoMes } from "@/lib/servicos/ponto";

/**
 * Ações de um toque das pendências (botões na tela inicial e nos avisos). O patrão decide o dia, lança o horário
 * do contrato, aprova pedidos e fecha o mês; a empregada informa que trabalhou no horário. Nada é apagado:
 * toda correção entra como ajuste com autor e motivo, e o outro lado é avisado.
 */

const TIPOS_MARCACAO = ["ENTRADA", "SAIDA_INTERVALO", "RETORNO_INTERVALO", "SAIDA"] as const;
const campo = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function empregadoDoPatrao(u: UsuarioLogado, empregadoId: string) {
  const e = await prisma.empregado.findUniqueOrThrow({ where: { id: empregadoId } });
  if (u.papel === "CLIENTE" && e.clienteId !== u.clienteId) throw new Error("Sem permissão.");
  if (u.papel !== "CLIENTE" && u.papel !== "CONSULTOR") throw new Error("Sem permissão.");
  return e;
}

/** Horário do contrato no dia (entrada, intervalo quando obrigatório, saída). */
function horarioDoDia(e: Awaited<ReturnType<typeof empregadoDoPatrao>>, data: Date) {
  const ds = DIAS_SEMANA[diaSemana(data)];
  const h = horariosDoEmpregado(e)?.[ds];
  const previsto = Math.round((jornadaDoEmpregado(e)[ds] ?? 0) * 60);
  if (!h || !previsto) throw new Error("O contrato não tem horário para este dia. Lance o horário pela tela do ponto.");
  return marcacoesDoContrato(h.entrada, h.saida, previsto, e.acordoIntervaloReduzido);
}

function tipoDaMarcacao(i: number, total: number) {
  return total === 2 ? (i === 0 ? "ENTRADA" : "SAIDA") : TIPOS_MARCACAO[i];
}

export async function resolverPendencia(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  try {
    const u = await usuarioAtual();
    if (!u) return { erro: "Faça login." };
    const tipo = campo(fd, "tipo");
    let mensagem = "Feito.";

    if (tipo === "TRATAR") {
      const e = await empregadoDoPatrao(u, campo(fd, "empregadoId"));
      const data = lerData(campo(fd, "data"));
      const tratamento = campo(fd, "tratamento");
      if (!["ABONAR", "COMPENSAR", "DESCONTAR"].includes(tratamento)) return { erro: "Opção inválida." };
      if (tratamento === "COMPENSAR" && !(e.regime === "INTEGRAL" && e.acordoCompensacao)) return { erro: "Compensação só existe no regime integral com acordo escrito." };
      await prisma.tratamentoDia.upsert({ where: { empregadoId_data: { empregadoId: e.id, data } }, create: { empregadoId: e.id, data, tratamento, decididoPorId: u.id }, update: { tratamento, decididoPorId: u.id } });
      const txt = { ABONAR: "abonado (não será descontado)", COMPENSAR: "para compensar no mês", DESCONTAR: "descontado" }[tratamento];
      await registrarAtividade({ usuarioId: u.id, clienteId: e.clienteId, acao: "PONTO_TRATAMENTO", descricao: `Dia ${formatarData(data)} de ${e.nome}: ${txt}` });
      await avisarEmpregada(e.id, { chave: `tratamento:${e.id}:${campo(fd, "data")}:${tratamento}`, titulo: `Dia ${formatarData(data)}: ${txt}`, texto: "Registro do empregador sobre as horas que faltaram neste dia. Já está no seu espelho do mês.", link: "/ponto/historico" });
      mensagem = `Dia ${formatarData(data)} ${txt}.`;
    } else if (tipo === "LANCAR_CONTRATO" || tipo === "COMPLETAR_SAIDA") {
      const e = await empregadoDoPatrao(u, campo(fd, "empregadoId"));
      const data = lerData(campo(fd, "data"));
      if (data > hojeBrasil()) return { erro: "Não dá para lançar dia futuro." };
      const horas = tipo === "LANCAR_CONTRATO" ? horarioDoDia(e, data) : [campo(fd, "hora")];
      const instantes = instantesDoDia(data, horas);
      for (const [i] of horas.entries()) {
        await prisma.ajustePonto.create({
          data: {
            empregadoId: e.id, data, tipo: "INCLUSAO", dataHora: instantes[i], tipoMarcacao: tipo === "COMPLETAR_SAIDA" ? "SAIDA" : tipoDaMarcacao(i, horas.length),
            justificativa: tipo === "LANCAR_CONTRATO" ? "Lançado pelo empregador: trabalhou no horário do contrato" : "Lançado pelo empregador: saída no horário do contrato",
            status: "APROVADO", solicitadoPorId: u.id, decididoPorId: u.id, decididoEm: new Date(),
          },
        });
      }
      await registrarAtividade({ usuarioId: u.id, clienteId: e.clienteId, acao: "AJUSTE_PONTO", descricao: `${u.nome} lançou ${horas.join(", ")} no ponto de ${e.nome} em ${formatarData(data)}` });
      await avisarEmpregada(e.id, { chave: `lancado:${e.id}:${campo(fd, "data")}`, titulo: `Seu ponto de ${formatarData(data)} foi lançado pelo empregador`, texto: `Horários: ${horas.join(", ")}. Já está no seu espelho do mês.`, link: "/ponto/historico" });
      mensagem = `Lançado: ${horas.join(", ")}.`;
    } else if (tipo === "DECIDIR_AJUSTES") {
      const e = await empregadoDoPatrao(u, campo(fd, "empregadoId"));
      const data = lerData(campo(fd, "data"));
      const decisao = campo(fd, "decisao") === "APROVADO" ? "APROVADO" : "REJEITADO";
      const r = await prisma.ajustePonto.updateMany({ where: { empregadoId: e.id, data, status: "PENDENTE" }, data: { status: decisao, decididoPorId: u.id, decididoEm: new Date() } });
      await registrarAtividade({ usuarioId: u.id, clienteId: e.clienteId, acao: "AJUSTE_DECIDIDO", descricao: `${r.count} ajuste(s) de ${e.nome} em ${formatarData(data)} ${decisao === "APROVADO" ? "aprovado(s)" : "recusado(s)"}` });
      await avisarEmpregada(e.id, { chave: `ajustes-decididos:${e.id}:${campo(fd, "data")}:${decisao}`, titulo: decisao === "APROVADO" ? "Ajuste do ponto aprovado" : "Ajuste do ponto não aprovado", texto: `Dia ${formatarData(data)}.${decisao === "REJEITADO" ? " Vale o registro do empregador." : ""}`, link: "/ponto/historico" });
      mensagem = decisao === "APROVADO" ? "Ajuste aprovado." : "Ajuste recusado.";
    } else if (tipo === "DECIDIR_JUSTIFICATIVA") {
      const j = await prisma.justificativa.findUniqueOrThrow({ where: { id: campo(fd, "id") } });
      const e = await empregadoDoPatrao(u, j.empregadoId);
      if (j.status !== "PENDENTE") return { erro: "Este pedido já foi decidido." };
      const decisao = campo(fd, "decisao") === "APROVADO" ? "APROVADO" : "REJEITADO";
      await prisma.justificativa.update({ where: { id: j.id }, data: { status: decisao, decididoPorId: u.id, decididoEm: new Date() } });
      await registrarAtividade({ usuarioId: u.id, clienteId: e.clienteId, acao: "JUSTIFICATIVA_DECIDIDA", descricao: `Justificativa de ${e.nome} (${formatarData(j.data)}) ${decisao === "APROVADO" ? "aceita" : "recusada"}` });
      await avisarEmpregada(e.id, { chave: `justificativa-decidida:${j.id}`, titulo: decisao === "APROVADO" ? "Justificativa aceita" : "Justificativa não aceita", texto: `Dia ${formatarData(j.data)}. ${decisao === "APROVADO" ? "O dia não será descontado." : "O dia segue o registro do empregador."}`, link: "/ponto/justificativas" });
      mensagem = decisao === "APROVADO" ? "Justificativa aceita." : "Justificativa recusada.";
    } else if (tipo === "FECHAR_MES") {
      const e = await empregadoDoPatrao(u, campo(fd, "empregadoId"));
      const ano = Number(campo(fd, "ano"));
      const mes = Number(campo(fd, "mes"));
      const adiant = campo(fd, "adiantamento");
      const adiantamento = adiant ? lerMoeda(adiant) : undefined;
      if (adiantamento !== undefined && adiantamento < 0) return { erro: "Adiantamento inválido." };
      const esp = await fecharMesPeloPonto(e, ano, mes, u.id, adiantamento);
      await registrarAtividade({ usuarioId: u.id, clienteId: e.clienteId, acao: "LANCAMENTO_PONTO", descricao: `${u.nome} fechou o ponto de ${formatarCompetencia(ano, mes)} de ${e.nome}: ${resumoDoMes(esp)}${adiantamento ? ` Adiantamento ${formatarMoeda(adiantamento)}.` : ""}` });
      await avisarEmpregada(e.id, { chave: `fechado:${e.id}:${ano}-${mes}`, titulo: `Ponto de ${formatarCompetencia(ano, mes)} fechado`, texto: `${resumoDoMes(esp)} O espelho do mês está no app para você conferir e assinar.`, link: "/ponto/historico" });
      mensagem = `Mês fechado e enviado ao consultor: ${resumoDoMes(esp)}`;
    } else if (tipo === "DAE_PAGO") {
      const c = await prisma.competencia.findUniqueOrThrow({ where: { id: campo(fd, "competenciaId") } });
      const e = await empregadoDoPatrao(u, c.empregadoId);
      await prisma.competencia.update({ where: { id: c.id }, data: { clienteInformouPagamentoEm: new Date() } });
      await registrarAtividade({ usuarioId: u.id, clienteId: e.clienteId, acao: "DAE_PAGO_CLIENTE", descricao: `${u.nome} informou o pagamento do DAE ${formatarCompetencia(c.ano, c.mes)} de ${e.nome}` });
      mensagem = "Pagamento informado. O consultor vai conferir.";
    } else if (tipo === "PEDIR_CONTRATO" || tipo === "PEDIR_SAIDA") {
      if (u.papel !== "EMPREGADO" || !u.empregadoId) return { erro: "Sem permissão." };
      const e = await prisma.empregado.findUniqueOrThrow({ where: { id: u.empregadoId } });
      const data = lerData(campo(fd, "data"));
      if (data > hojeBrasil()) return { erro: "Não dá para lançar dia futuro." };
      const horas = tipo === "PEDIR_CONTRATO" ? horarioDoDia(e, data) : [campo(fd, "hora")];
      const instantes = instantesDoDia(data, horas);
      for (const [i] of horas.entries()) {
        await prisma.ajustePonto.create({
          data: { empregadoId: e.id, data, tipo: "INCLUSAO", dataHora: instantes[i], tipoMarcacao: tipo === "PEDIR_SAIDA" ? "SAIDA" : tipoDaMarcacao(i, horas.length), justificativa: tipo === "PEDIR_CONTRATO" ? "Trabalhei no meu horário normal e esqueci de marcar" : "Saí no meu horário normal e esqueci de marcar", solicitadoPorId: u.id },
        });
      }
      await registrarAtividade({ usuarioId: u.id, clienteId: e.clienteId, acao: "AJUSTE_PONTO", descricao: `${u.nome} pediu ajuste em ${formatarData(data)}: ${horas.join(", ")}` });
      await avisarPatroes(e.clienteId, { chave: `pedido:${e.id}:${campo(fd, "data")}:${tipo}`, titulo: `${e.nome.split(" ")[0]} pediu ajuste no ponto de ${formatarData(data)}`, texto: `${tipo === "PEDIR_CONTRATO" ? "Diz que trabalhou no horário normal" : "Diz que saiu no horário normal"} (${horas.join(", ")}). Aprove ou recuse num toque.`, link: "/cliente", acao: "Responder" });
      mensagem = "Pedido enviado ao empregador. Você será avisada da resposta.";
    } else {
      return { erro: "Ação desconhecida." };
    }
    revalidatePath("/cliente");
    revalidatePath("/cliente/ponto");
    revalidatePath("/ponto");
    revalidatePath("/ponto/historico");
    return { ok: true, mensagem };
  } catch (e) {
    return erroParaEstado(e);
  }
}
