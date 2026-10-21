import Link from "next/link";
import type { Empregado } from "@prisma/client";
import { gerarLancamentoDoPonto } from "@/app/acoes-ponto";
import { competenciaAnterior, formatarMoeda, formatarNumero, minutosParaHora, nomeMes, proximaCompetencia } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { espelhoDoMes } from "@/lib/servicos/ponto";
import { Formulario } from "./Formulario";
import { TabelaEspelho } from "./TabelaEspelho";
import { Aviso, Cartao, Indicador, Selo } from "./ui";

/** Espelho mensal com resumo em horas e em reais por rubrica (para consultor e empregador). */
export async function EspelhoEmpregado({ empregado, ano, mes, base, podeGerarLancamento }: { empregado: Empregado; ano: number; mes: number; base: string; podeGerarLancamento: boolean }) {
  const esp = await espelhoDoMes(empregado, ano, mes);
  const espelho = await prisma.espelhoPonto.findUnique({ where: { empregadoId_ano_mes: { empregadoId: empregado.id, ano, mes } } });
  const ant = competenciaAnterior(ano, mes);
  const prox = proximaCompetencia(ano, mes);
  const rubricas = [
    ["Horas extras 50%", `${formatarNumero(esp.horas.extras50)} h`, esp.valores.horasExtras50],
    ["Horas extras 100%", `${formatarNumero(esp.horas.extras100)} h`, esp.valores.horasExtras100],
    ["Adicional noturno (20%)", `${formatarNumero(esp.horas.noturno)} h`, esp.valores.adicionalNoturno],
    ["Intervalo não concedido (+50%)", `${formatarNumero(esp.horas.intervaloSuprimido)} h`, esp.valores.intervaloSuprimido],
    ["Faltas injustificadas (desconto)", `${esp.resumo.faltas} dia(s)`, -esp.valores.faltas],
    ["DSR perdido (desconto)", `${esp.resumo.semanasComFalta} semana(s)`, -esp.valores.dsrPerdido],
    ["Atrasos (desconto)", minutosParaHora(esp.resumo.atrasoDescontado), -esp.valores.atrasos],
  ] as const;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold" href={`${base}?ano=${ant.ano}&mes=${ant.mes}`}>←</Link>
        <h2 className="text-xl font-bold capitalize">{nomeMes(mes)}/{ano}</h2>
        <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold" href={`${base}?ano=${prox.ano}&mes=${prox.mes}`}>→</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Trabalhado / previsto" valor={`${formatarNumero(esp.horas.trabalhado)}h`} detalhe={`previsto ${formatarNumero(esp.horas.previsto)}h`} />
        <Indicador rotulo="Extras a pagar" valor={`${formatarNumero(esp.horas.extras50 + esp.horas.extras100)}h`} cor="amarelo" detalhe={empregado.regime === "INTEGRAL" && empregado.acordoCompensacao ? `banco: ${formatarNumero(esp.horas.banco)}h` : empregado.regime === "INTEGRAL" ? "sem acordo de compensação" : "regime sem banco de horas"} />
        <Indicador rotulo="Faltas" valor={esp.resumo.faltas} cor={esp.resumo.faltas ? "vermelho" : "verde"} detalhe={`${esp.resumo.faltasJustificadas} justificada(s)`} />
        <Indicador rotulo="Ocorrências" valor={esp.resumo.inconsistencias} cor={esp.resumo.inconsistencias ? "vermelho" : "verde"} />
      </div>
      {esp.resumo.observacoes.map((o) => <Aviso key={o}>{o}</Aviso>)}
      <Cartao titulo="Resumo para a folha (rubricas do eSocial)">
        <ul className="divide-y divide-slate-100 text-sm">
          {rubricas.filter((r) => r[2] !== 0).map((r) => (
            <li key={r[0]} className="flex justify-between py-1.5"><span>{r[0]} <span className="text-slate-500">({r[1]})</span></span><span className={`font-semibold tabular-nums ${r[2] < 0 ? "text-red-700" : ""}`}>{formatarMoeda(r[2])}</span></li>
          ))}
          {rubricas.every((r) => r[2] === 0) && <li className="py-2 text-slate-500">Nenhuma rubrica variável no mês.</li>}
        </ul>
        {podeGerarLancamento && (
          <div className="mt-3">
            <Formulario acao={gerarLancamentoDoPonto} textoBotao="Enviar estes valores para a rotina mensal" variante="secundario">
              <input type="hidden" name="empregadoId" value={empregado.id} />
              <input type="hidden" name="ano" value={ano} />
              <input type="hidden" name="mes" value={mes} />
            </Formulario>
          </div>
        )}
        <p className="mt-3 text-sm">
          Espelho assinado: {espelho ? <>empregado {espelho.assinadoEmpregadoEm ? <Selo cor="verde">sim</Selo> : <Selo cor="amarelo">pendente</Selo>} · empregador {espelho.assinadoEmpregadorEm ? <Selo cor="verde">sim</Selo> : <Selo cor="amarelo">pendente</Selo>}</> : <Selo>não gerado</Selo>}
        </p>
      </Cartao>
      <Cartao titulo="Dia a dia"><TabelaEspelho dias={esp.dias} /></Cartao>
    </div>
  );
}
