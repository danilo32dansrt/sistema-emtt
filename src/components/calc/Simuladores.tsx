"use client";

import { useState } from "react";
import {
  compararModelos, escolherTabela, formatarMoeda, salarioMinimoProporcional, simularCustoContratacao, simularHoraExtra, simularReajuste, type TabelaAnual,
} from "@/lib/calculos";
import { AvisoEstimativa, Aviso, MemoriaCalculo } from "../ui";
import { CampoCalc, ChecaCalc, n, Resumo } from "./campos";

const ABAS = [
  { id: "custo", rotulo: "Custo de contratar" },
  { id: "comparador", rotulo: "Diarista x mensalista" },
  { id: "reajuste", rotulo: "Reajuste" },
  { id: "extra", rotulo: "Hora extra e noturno" },
];

export function Simuladores({ tabelas, ano }: { tabelas: TabelaAnual[]; ano: number }) {
  const [aba, setAba] = useState("custo");
  const { tabela } = escolherTabela(tabelas, ano);
  const proxima = tabelas.find((t) => t.ano === ano + 1);
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {ABAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)} className={`min-h-11 shrink-0 rounded-xl px-4 font-semibold ${aba === a.id ? "bg-marca-600 text-white" : "border border-slate-300 bg-white"}`}>{a.rotulo}</button>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        {aba === "custo" && <Custo tabela={tabela} />}
        {aba === "comparador" && <Comparador tabela={tabela} />}
        {aba === "reajuste" && <Reajuste tabela={tabela} proxima={proxima} />}
        {aba === "extra" && <Extra tabela={tabela} />}
        <AvisoEstimativa />
      </div>
    </div>
  );
}

function Custo({ tabela }: { tabela: TabelaAnual }) {
  const [f, setF] = useState({ salario: String(tabela.salarioMinimo).replace(".", ","), horas: "44", vt: "" });
  const minimo = salarioMinimoProporcional(tabela.salarioMinimo, n(f.horas));
  const r = simularCustoContratacao({ salario: n(f.salario), horasSemanais: n(f.horas), custoValeTransporte: n(f.vt), tabela });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <CampoCalc rotulo="Salário mensal (R$)" valor={f.salario} onChange={(v) => setF({ ...f, salario: v })} ajuda={`Mínimo para ${f.horas}h: ${formatarMoeda(minimo)}`} />
        <CampoCalc rotulo="Horas por semana" valor={f.horas} onChange={(v) => setF({ ...f, horas: v })} />
        <CampoCalc rotulo="Custo mensal de condução (R$)" valor={f.vt} onChange={(v) => setF({ ...f, vt: v })} ajuda="Deixe vazio se não usar vale-transporte." />
      </div>
      {n(f.salario) < minimo && <Aviso tipo="critico">Salário abaixo do mínimo proporcional ({formatarMoeda(minimo)}).</Aviso>}
      <Resumo itens={[
        { rotulo: "DAE mensal", valor: formatarMoeda(r.dae) },
        { rotulo: "Líquido da empregada", valor: formatarMoeda(n(f.salario) - r.inssEmpregado) },
        { rotulo: "Guardar por mês (provisões)", valor: formatarMoeda(r.mensal.provisao13 + r.mensal.provisaoFerias + r.mensal.encargosProvisoes + r.mensal.provisaoRescisao) },
        { rotulo: "Custo mensal médio", valor: formatarMoeda(r.mensal.total), destaque: true },
        { rotulo: "Custo anual", valor: formatarMoeda(r.anual.total) },
      ]} />
      <MemoriaCalculo linhas={r.memoria.linhas} />
    </div>
  );
}

function Comparador({ tabela }: { tabela: TabelaAnual }) {
  const [f, setF] = useState({ diaria: "180", dias: "2", salarioParcial: "", horasParcial: "22", salarioIntegral: String(tabela.salarioMinimo).replace(".", ",") });
  const r = compararModelos({ tabela, diarista: { valorDiaria: n(f.diaria), diasPorSemana: n(f.dias) }, parcial: { salario: n(f.salarioParcial), horasSemanais: n(f.horasParcial) }, integral: { salario: n(f.salarioIntegral) } });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-5">
        <CampoCalc rotulo="Valor da diária (R$)" valor={f.diaria} onChange={(v) => setF({ ...f, diaria: v })} />
        <CampoCalc rotulo="Dias por semana (diarista)" valor={f.dias} onChange={(v) => setF({ ...f, dias: v })} />
        <CampoCalc rotulo="Salário parcial (R$)" valor={f.salarioParcial} onChange={(v) => setF({ ...f, salarioParcial: v })} ajuda="Vazio = mínimo proporcional" />
        <CampoCalc rotulo="Horas semanais (parcial)" valor={f.horasParcial} onChange={(v) => setF({ ...f, horasParcial: v })} />
        <CampoCalc rotulo="Salário integral (R$)" valor={f.salarioIntegral} onChange={(v) => setF({ ...f, salarioIntegral: v })} />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {r.map((m) => (
          <div key={m.modelo} className="rounded-2xl border border-slate-200 p-4">
            <p className="text-lg font-bold">{m.modelo}</p>
            <p className="text-sm text-slate-600">{m.descricao}</p>
            <p className="mt-2 text-2xl font-bold text-marca-700">{formatarMoeda(m.custoMensal)}<span className="text-sm font-normal text-slate-500">/mês</span></p>
            <p className="text-sm text-slate-600">{formatarMoeda(m.custoAnual)} por ano</p>
            {m.alerta && <div className="mt-2"><Aviso tipo="aviso">{m.alerta}</Aviso></div>}
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{m.obrigacoes.map((o) => <li key={o}>{o}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Reajuste({ tabela, proxima }: { tabela: TabelaAnual; proxima?: TabelaAnual }) {
  const [f, setF] = useState({ atual: String(tabela.salarioMinimo).replace(".", ","), novo: String(proxima?.salarioMinimo ?? Math.round(tabela.salarioMinimo * 1.05)).replace(".", ","), horas: "44" });
  const r = simularReajuste({ salarioAtual: n(f.atual), salarioNovo: n(f.novo), horasSemanais: n(f.horas), tabelaAtual: tabela, tabelaNova: proxima });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <CampoCalc rotulo="Salário atual (R$)" valor={f.atual} onChange={(v) => setF({ ...f, atual: v })} />
        <CampoCalc rotulo="Novo salário (R$)" valor={f.novo} onChange={(v) => setF({ ...f, novo: v })} />
        <CampoCalc rotulo="Horas semanais" valor={f.horas} onChange={(v) => setF({ ...f, horas: v })} />
      </div>
      {r.abaixoDoMinimo && <Aviso tipo="critico">O novo salário fica abaixo do mínimo proporcional ({formatarMoeda(r.minimoProporcionalNovo)}).</Aviso>}
      <Resumo itens={[
        { rotulo: "Reajuste", valor: `${r.percentual.toLocaleString("pt-BR")}%` },
        { rotulo: "Custo mensal hoje", valor: formatarMoeda(r.atual.mensal.total) },
        { rotulo: "Custo mensal novo", valor: formatarMoeda(r.novo.mensal.total) },
        { rotulo: "Aumento por mês", valor: formatarMoeda(r.diferencaMensal), destaque: true },
        { rotulo: "Aumento por ano", valor: formatarMoeda(r.diferencaAnual) },
        { rotulo: "Novo DAE", valor: formatarMoeda(r.novo.dae) },
      ]} />
    </div>
  );
}

function Extra({ tabela }: { tabela: TabelaAnual }) {
  const [f, setF] = useState({ salario: String(tabela.salarioMinimo).replace(".", ","), horas: "44", extras: "2", noturnas: "0", domingo: false });
  const r = simularHoraExtra({ salario: n(f.salario), horasSemanais: n(f.horas), horasExtras: n(f.extras), horasNoturnasReais: n(f.noturnas), domingoOuFeriado: f.domingo, tabela });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-5">
        <CampoCalc rotulo="Salário (R$)" valor={f.salario} onChange={(v) => setF({ ...f, salario: v })} />
        <CampoCalc rotulo="Horas semanais" valor={f.horas} onChange={(v) => setF({ ...f, horas: v })} />
        <CampoCalc rotulo="Horas a mais" valor={f.extras} onChange={(v) => setF({ ...f, extras: v })} />
        <CampoCalc rotulo="Horas entre 22h e 5h" valor={f.noturnas} onChange={(v) => setF({ ...f, noturnas: v })} />
        <ChecaCalc rotulo="Domingo ou feriado" valor={f.domingo} onChange={(v) => setF({ ...f, domingo: v })} />
      </div>
      <Resumo itens={[
        { rotulo: "Valor da hora", valor: formatarMoeda(r.valorHora) },
        { rotulo: "Horas extras", valor: formatarMoeda(r.extras) },
        { rotulo: "Adicional noturno", valor: formatarMoeda(r.noturno) },
        { rotulo: "Custo total do pedido", valor: formatarMoeda(r.total), destaque: true },
      ]} />
      <MemoriaCalculo linhas={r.memoria.linhas} />
    </div>
  );
}
