import Link from "next/link";
import { Cartao, Indicador, Selo, Titulo, Vazio } from "@/components/ui";
import {
  addDias, competenciaAnterior, diferencaDias, ETAPAS_CHECKLIST, formatarCompetencia, formatarData, formatarMoeda, hojeBrasil, ROTULOS_EVENTO, situacaoChecklist,
} from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { num } from "@/lib/conversao";
import { agendaDoBanco } from "@/lib/servicos/agenda";
import { competenciaPadrao } from "@/lib/servicos/competencia";
import { validacoesDoEmpregado } from "@/lib/servicos/empregado";

export const metadata = { title: "Painel" };

type Pendencia = { prioridade: 1 | 2 | 3; texto: string; detalhe?: string; href: string };

export default async function Painel() {
  const hoje = hojeBrasil();
  const comp = competenciaPadrao(hoje);
  const [clientes, empregados, competencias, mensalidadesAtrasadas, agenda, ajustesPendentes] = await Promise.all([
    prisma.cliente.findMany({ where: { ativo: true, anonimizadoEm: null }, select: { id: true, nome: true, procuracaoStatus: true, procuracaoValidade: true } }),
    prisma.empregado.findMany({ where: { situacao: { not: "DESLIGADO" }, cliente: { ativo: true } }, include: { cliente: { select: { nome: true } } } }),
    prisma.competencia.findMany({ where: { OR: [{ ano: comp.ano, mes: comp.mes }, { pagamentoConfirmado: false }] } }),
    prisma.mensalidade.findMany({ where: { status: "ABERTO", vencimento: { lt: hoje } }, include: { cliente: { select: { nome: true } } } }),
    agendaDoBanco({ de: addDias(hoje, -7), ate: addDias(hoje, 30), hoje }),
    prisma.ajustePonto.count({ where: { status: "PENDENTE" } }),
  ]);

  const pendencias: Pendencia[] = [];

  // Checklist da competência em foco e da anterior (mesmo que ninguém tenha começado o checklist)
  let atrasadosChecklist = 0;
  let pendentesChecklist = 0;
  const ant = competenciaAnterior(comp.ano, comp.mes);
  for (const alvo of [ant, comp]) {
    const ehFoco = alvo === comp;
    for (const e of empregados) {
      if (e.admissao > new Date(Date.UTC(alvo.ano, alvo.mes, 0))) continue;
      const c = competencias.find((x) => x.empregadoId === e.id && x.ano === alvo.ano && x.mes === alvo.mes);
      const s = situacaoChecklist(alvo.ano, alvo.mes, c ?? {}, hoje);
      if (s.status === "atrasado") {
        if (ehFoco) atrasadosChecklist++;
        const etapa = ETAPAS_CHECKLIST.find((x) => x.campo === s.atrasadas[0])?.curto;
        pendencias.push({ prioridade: s.atrasadas.includes("pagamentoConfirmado") ? 1 : 2, texto: `${e.nome} (${e.cliente.nome}) — ${formatarCompetencia(alvo.ano, alvo.mes)} atrasado`, detalhe: s.atrasadas.includes("pagamentoConfirmado") ? `DAE venceu em ${formatarData(s.vencimentoDae)} sem pagamento confirmado` : `Etapa atrasada: ${etapa}`, href: `/consultor/rotina?ano=${alvo.ano}&mes=${alvo.mes}` });
      } else if (s.status === "pendente" && ehFoco) pendentesChecklist++;
    }
  }
  // DAEs de competências mais antigas ainda sem pagamento confirmado
  for (const c of competencias.filter((x) => !(x.ano === comp.ano && x.mes === comp.mes) && !(x.ano === ant.ano && x.mes === ant.mes))) {
    const s = situacaoChecklist(c.ano, c.mes, c, hoje);
    if (s.atrasadas.includes("pagamentoConfirmado")) {
      const e = empregados.find((x) => x.id === c.empregadoId);
      if (e) pendencias.push({ prioridade: 1, texto: `DAE ${formatarCompetencia(c.ano, c.mes)} sem pagamento confirmado — ${e.cliente.nome}`, detalhe: `Venceu em ${formatarData(s.vencimentoDae)}`, href: `/consultor/rotina?ano=${c.ano}&mes=${c.mes}` });
    }
  }

  for (const c of clientes) {
    const dias = c.procuracaoValidade ? diferencaDias(hoje, c.procuracaoValidade) : null;
    if (c.procuracaoStatus !== "ATIVA" || (dias !== null && dias < 0)) {
      pendencias.push({ prioridade: 1, texto: `Procuração ${dias !== null && dias < 0 ? "vencida" : c.procuracaoStatus.toLowerCase()} — ${c.nome}`, href: `/consultor/clientes/${c.id}` });
    } else if (dias !== null && dias <= 30) {
      pendencias.push({ prioridade: 2, texto: `Procuração vence em ${dias} dia(s) — ${c.nome}`, href: `/consultor/clientes/${c.id}` });
    }
  }

  for (const e of empregados) {
    const v = await validacoesDoEmpregado(e, hoje);
    for (const a of v.filter((x) => x.severidade === "critico")) {
      pendencias.push({ prioridade: 1, texto: `${e.nome} (${e.cliente.nome})`, detalhe: a.mensagem, href: `/consultor/empregados/${e.id}` });
    }
  }

  for (const ev of agenda.filter((x) => x.severidade === "critico" && x.tipo !== "DAE_MENSAL")) {
    pendencias.push({ prioridade: 1, texto: ev.titulo, detalhe: `${formatarData(ev.data)} — ${ev.descricao}`, href: ev.empregadoId ? `/consultor/empregados/${ev.empregadoId}` : "/consultor/agenda" });
  }
  for (const m of mensalidadesAtrasadas) {
    pendencias.push({ prioridade: 3, texto: `Mensalidade ${formatarCompetencia(m.ano, m.mes)} em aberto — ${m.cliente.nome}`, detalhe: `${formatarMoeda(num(m.valor))}, venceu em ${formatarData(m.vencimento)}`, href: "/consultor/financeiro" });
  }
  if (ajustesPendentes) pendencias.push({ prioridade: 2, texto: `${ajustesPendentes} ajuste(s) de ponto aguardando o empregador`, href: "/consultor/ponto" });

  pendencias.sort((a, b) => a.prioridade - b.prioridade);
  const proximos = agenda.filter((e) => e.data >= hoje).slice(0, 8);
  const daesSemana = agenda.filter((e) => e.tipo === "DAE_MENSAL" && e.data >= hoje && diferencaDias(hoje, e.data) <= 7).length;

  return (
    <>
      <Titulo subtitulo={`Hoje é ${formatarData(hoje)}. Competência em foco: ${formatarCompetencia(comp.ano, comp.mes)}.`}>Painel geral</Titulo>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Clientes ativos" valor={clientes.length} href="/consultor/clientes" detalhe={`${empregados.length} empregado(s)`} />
        <Indicador rotulo="Rotina atrasada" valor={atrasadosChecklist} cor={atrasadosChecklist ? "vermelho" : "verde"} href="/consultor/rotina" detalhe={`${pendentesChecklist} em andamento`} />
        <Indicador rotulo="DAEs vencendo em 7 dias" valor={daesSemana} cor={daesSemana ? "amarelo" : "verde"} href="/consultor/agenda" />
        <Indicador rotulo="Pendências" valor={pendencias.length} cor={pendencias.some((p) => p.prioridade === 1) ? "vermelho" : "azul"} detalhe={`${pendencias.filter((p) => p.prioridade === 1).length} urgentes`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Cartao titulo="Pendências por prioridade" className="lg:col-span-2">
          {pendencias.length === 0 ? (
            <Vazio>Tudo em dia! 🎉</Vazio>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendencias.slice(0, 40).map((p, i) => (
                <li key={i} className="py-2">
                  <Link href={p.href} className="flex items-start gap-3 rounded-lg p-1 hover:bg-slate-50">
                    <Selo cor={p.prioridade === 1 ? "vermelho" : p.prioridade === 2 ? "amarelo" : "cinza"}>{p.prioridade === 1 ? "Urgente" : p.prioridade === 2 ? "Atenção" : "Normal"}</Selo>
                    <span>
                      <span className="block font-medium text-slate-800">{p.texto}</span>
                      {p.detalhe && <span className="block text-sm text-slate-600">{p.detalhe}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Próximos vencimentos" acoes={<Link className="text-sm font-semibold text-marca-700" href="/consultor/agenda">Ver agenda</Link>}>
          {proximos.length === 0 ? (
            <Vazio>Nada nos próximos 30 dias.</Vazio>
          ) : (
            <ul className="space-y-2">
              {proximos.map((e) => (
                <li key={e.chave} className="rounded-lg border border-slate-100 p-2">
                  <p className="text-xs font-semibold text-slate-500">{formatarData(e.data)} · {ROTULOS_EVENTO[e.tipo]}</p>
                  <p className="text-sm font-medium">{e.titulo}</p>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}
