import Link from "next/link";
import { TabelaEspelho } from "@/components/TabelaEspelho";
import { Cartao, Selo } from "@/components/ui";
import { exigirEmpregado } from "@/lib/auth/sessao";
import { competenciaAnterior, formatarCompetencia, formatarNumero, hojeBrasil, minutosParaHora, nomeMes, proximaCompetencia } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { ROTULO_MARCACAO } from "@/lib/ponto/registro";
import { espelhoDoMes } from "@/lib/servicos/ponto";

export default async function Historico({ searchParams }: { searchParams: Promise<{ ano?: string; mes?: string }> }) {
  const u = await exigirEmpregado();
  const sp = await searchParams;
  const hoje = hojeBrasil();
  const ano = Number(sp.ano) || hoje.getUTCFullYear();
  const mes = Number(sp.mes) || hoje.getUTCMonth() + 1;
  const emp = await prisma.empregado.findUniqueOrThrow({ where: { id: u.empregadoId } });
  const esp = await espelhoDoMes(emp, ano, mes);
  const espelho = await prisma.espelhoPonto.findUnique({ where: { empregadoId_ano_mes: { empregadoId: emp.id, ano, mes } } });
  const ant = competenciaAnterior(ano, mes);
  const prox = proximaCompetencia(ano, mes);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link className="rounded-xl border border-slate-300 px-3 py-2 text-sm" href={`/ponto/historico?ano=${ant.ano}&mes=${ant.mes}`}>←</Link>
        <h1 className="text-xl font-bold capitalize">{nomeMes(mes)}/{ano}</h1>
        <Link className="rounded-xl border border-slate-300 px-3 py-2 text-sm" href={`/ponto/historico?ano=${prox.ano}&mes=${prox.mes}`}>→</Link>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-white p-3 shadow-sm"><p className="text-xs text-slate-500">Trabalhado</p><p className="text-xl font-bold">{formatarNumero(esp.horas.trabalhado)} h</p></div>
        <div className="rounded-2xl bg-white p-3 shadow-sm"><p className="text-xs text-slate-500">Horas extras</p><p className="text-xl font-bold">{formatarNumero(esp.horas.extras50 + esp.horas.extras100)} h</p></div>
        <div className="rounded-2xl bg-white p-3 shadow-sm"><p className="text-xs text-slate-500">Banco de horas</p><p className="text-xl font-bold">{formatarNumero(esp.horas.banco)} h</p></div>
        <div className="rounded-2xl bg-white p-3 shadow-sm"><p className="text-xs text-slate-500">Faltas / atrasos</p><p className="text-xl font-bold">{esp.resumo.faltas} / {minutosParaHora(esp.resumo.atrasoDescontado)}</p></div>
      </div>
      {espelho && (
        <Cartao titulo={`Espelho de ${formatarCompetencia(ano, mes)}`}>
          <p className="text-sm">Sua assinatura: {espelho.assinadoEmpregadoEm ? <Selo cor="verde">assinado</Selo> : <Selo cor="amarelo">pendente</Selo>} · Empregador: {espelho.assinadoEmpregadorEm ? <Selo cor="verde">assinado</Selo> : <Selo cor="amarelo">pendente</Selo>}</p>
          {espelho.documentoId && <Link className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-marca-600 px-4 font-semibold text-white" href={`/ponto/documentos/${espelho.documentoId}`}>Ver e assinar o espelho</Link>}
        </Cartao>
      )}
      <Cartao titulo="Dia a dia"><TabelaEspelho dias={esp.dias} /></Cartao>
      <Cartao titulo="Comprovantes das marcações">
        <ul className="divide-y divide-slate-100 text-sm">
          {esp.marcacoes.map((m) => (
            <li key={m.id} className="py-2">
              <p><strong>{ROTULO_MARCACAO[m.tipo]}</strong> — {m.dataHora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} {m.origem === "OFFLINE" && <Selo>offline</Selo>}</p>
              <p className="break-all text-xs text-slate-500">NSR {String(m.nsr).padStart(9, "0")} · {m.hash}</p>
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}
