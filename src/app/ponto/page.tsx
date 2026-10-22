import { AtivarAvisos } from "@/components/AtivarAvisos";
import { BotaoSOS } from "@/components/BotaoSOS";
import { Pendencias } from "@/components/Pendencias";
import { Aviso, Cartao } from "@/components/ui";
import { exigirEmpregado } from "@/lib/auth/sessao";
import { addDias, DIAS_SEMANA, diaSemana, hojeBrasil } from "@/lib/calculos";
import { horariosDoEmpregado, jornadaDoEmpregado } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { chavePublicaPush } from "@/lib/notificacoes";
import { pendenciasDaEmpregada } from "@/lib/servicos/lembretes";
import { aceitarPrivacidade } from "./acoes";
import { RelogioPonto } from "./RelogioPonto";
import { TextoPrivacidade } from "./TextoPrivacidade";

export default async function PaginaPonto() {
  const u = await exigirEmpregado();
  const emp = await prisma.empregado.findUniqueOrThrow({ where: { id: u.empregadoId } });

  if (!u.consentimentoLgpdEm) {
    return (
      <Cartao titulo="Antes de começar: sua privacidade">
        <TextoPrivacidade />
        <form action={aceitarPrivacidade} className="mt-4">
          <button className="min-h-14 w-full rounded-2xl bg-marca-600 text-lg font-bold text-white">Li e estou ciente</button>
        </form>
      </Cartao>
    );
  }
  if (!emp.pontoAtivo || emp.situacao === "DESLIGADO") {
    return <Aviso tipo="aviso">O ponto eletrônico não está ativo para você. Fale com seu empregador.</Aviso>;
  }

  // Marcações desde o início do dia local (ou da jornada noturna iniciada ontem)
  const hoje = hojeBrasil();
  const inicio = new Date(hoje.getTime() + 3 * 3600_000);
  const marcacoes = await prisma.marcacaoPonto.findMany({
    where: { empregadoId: emp.id, dataHora: { gte: inicio, lt: new Date(addDias(hoje, 1).getTime() + 3 * 3600_000) } },
    orderBy: { dataHora: "asc" },
    select: { tipo: true, dataHora: true },
  });
  // Horário de hoje e de amanhã (escala do horário flexível ou o do contrato)
  const escalas = await prisma.escalaDia.findMany({ where: { empregadoId: emp.id, data: { gte: hoje, lte: addDias(hoje, 1) } } });
  const horarios = horariosDoEmpregado(emp);
  const horarioDo = (d: Date) => {
    const x = escalas.find((y) => y.data.getTime() === d.getTime());
    const h = horarios?.[DIAS_SEMANA[diaSemana(d)]];
    return x ? `${x.entrada} às ${x.saida}` : h && jornadaDoEmpregado(emp)[DIAS_SEMANA[diaSemana(d)]] ? `${h.entrada} às ${h.saida}` : "folga";
  };
  // Pendências de dias anteriores (as de hoje se resolvem no próprio botão de marcar)
  const pendencias = (await pendenciasDaEmpregada(emp.id)).filter((p) => p.link !== "/ponto");
  return (
    <>
      <Pendencias itens={pendencias} titulo="Resolva o seu ponto" />
      <div className="mb-3 flex justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span>Hoje: <b>{horarioDo(hoje)}</b></span>
        <span>Amanhã: <b>{horarioDo(addDias(hoje, 1))}</b></span>
      </div>
      <RelogioPonto
        nome={emp.nome}
        exigirSelfie={emp.exigirSelfie}
        exigirLocalizacao={emp.exigirLocalizacao}
        marcacoesHoje={marcacoes.map((m) => ({ tipo: m.tipo, dataHora: m.dataHora.toISOString() }))}
      />
      <BotaoSOS />
      <div className="mt-4"><AtivarAvisos chavePublica={await chavePublicaPush()} compacto /></div>
    </>
  );
}
