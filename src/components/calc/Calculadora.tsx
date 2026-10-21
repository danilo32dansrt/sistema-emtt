"use client";

import { useMemo, useState } from "react";
import {
  calcularDecimoTerceiro, calcularFerias, calcularFolhaMensal, calcularRegularizacao, calcularRescisao, competenciasEntre, diasDireitoFerias,
  escolherTabela, formatarData, formatarMoeda, NOMES_RESCISAO, periodosFerias, type ModoAviso, type TipoRescisao,
} from "@/lib/calculos";
import { AvisoEstimativa, Aviso, Celula, MemoriaCalculo, Selo, Tabela } from "../ui";
import { CampoCalc, ChecaCalc, d, n, Resumo, SelecaoCalc } from "./campos";
import type { EmpregadoCalc, PropsCalculadora } from "./tipos";

const ABAS = [
  { id: "folha", rotulo: "Folha e DAE" },
  { id: "decimo", rotulo: "13º salário" },
  { id: "ferias", rotulo: "Férias" },
  { id: "rescisao", rotulo: "Rescisão" },
  { id: "regularizacao", rotulo: "Regularização" },
];

function iso(dt: Date) {
  return dt.toISOString().slice(0, 10);
}

export function Calculadora(p: PropsCalculadora) {
  const hoje = d(p.hoje)!;
  const [aba, setAba] = useState(p.inicial?.aba && ABAS.some((a) => a.id === p.inicial?.aba) ? p.inicial.aba : "folha");
  const [empId, setEmpId] = useState(p.inicial?.empregadoId ?? "");
  const emp = p.empregados.find((e) => e.id === empId);
  const [base, setBase] = useState(() => dadosBase(emp));

  function escolherEmpregado(id: string) {
    setEmpId(id);
    setBase(dadosBase(p.empregados.find((e) => e.id === id)));
  }
  const tabelaDoAno = (ano: number) => escolherTabela(p.tabelas, ano);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <SelecaoCalc rotulo="Empregado (opcional — preenche os dados)" valor={empId} onChange={escolherEmpregado} opcoes={[{ valor: "", rotulo: "— digitar os dados —" }, ...p.empregados.map((e) => ({ valor: e.id, rotulo: `${e.nome} (${e.cliente})` }))]} />
        </div>
        <CampoCalc rotulo="Salário (R$)" valor={base.salario} onChange={(v) => setBase({ ...base, salario: v })} />
        <CampoCalc rotulo="Horas semanais" valor={base.horas} onChange={(v) => setBase({ ...base, horas: v })} />
        <CampoCalc rotulo="Admissão" tipo="date" valor={base.admissao} onChange={(v) => setBase({ ...base, admissao: v })} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {ABAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)} className={`min-h-11 shrink-0 rounded-xl px-4 font-semibold ${aba === a.id ? "bg-marca-600 text-white" : "border border-slate-300 bg-white"}`}>
            {a.rotulo}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        {aba === "folha" && <AbaFolha base={base} emp={emp} tabelaDoAno={tabelaDoAno} inicial={p.inicial} hoje={hoje} />}
        {aba === "decimo" && <AbaDecimo base={base} tabelaDoAno={tabelaDoAno} hoje={hoje} />}
        {aba === "ferias" && <AbaFerias base={base} emp={emp} tabelaDoAno={tabelaDoAno} hoje={hoje} regra={p.regraFeriasParcial} />}
        {aba === "rescisao" && <AbaRescisao base={base} emp={emp} tabelaDoAno={tabelaDoAno} hoje={hoje} />}
        {aba === "regularizacao" && <AbaRegularizacao base={base} tabelas={p.tabelas} hoje={hoje} selic={p.selicMensal} />}
        <AvisoEstimativa />
      </div>
    </div>
  );
}

type Base = ReturnType<typeof dadosBase>;
type TabelaFn = (ano: number) => ReturnType<typeof escolherTabela>;

function dadosBase(e?: EmpregadoCalc) {
  return {
    salario: e ? String(e.salario).replace(".", ",") : "1621,00",
    horas: e ? String(e.horasSemanais).replace(".", ",") : "44",
    admissao: e?.admissao ?? "",
    dependentes: String(e?.dependentes ?? 0),
    vt: e?.valeTransporte ? String(e.valeTransporte).replace(".", ",") : "",
    regime: e?.regime ?? "INTEGRAL",
  };
}

function AvisoTabela({ aproximada, ano }: { aproximada: boolean; ano: number }) {
  return aproximada ? <Aviso tipo="aviso">Não há tabela cadastrada para {ano}; foi usada a do ano mais recente. Atualize em “Tabelas anuais”.</Aviso> : null;
}

function AbaFolha({ base, emp, tabelaDoAno, inicial, hoje }: { base: Base; emp?: EmpregadoCalc; tabelaDoAno: TabelaFn; inicial?: PropsCalculadora["inicial"]; hoje: Date }) {
  const [f, setF] = useState({ ano: String(inicial?.ano ?? hoje.getUTCFullYear()), mes: String(inicial?.mes ?? hoje.getUTCMonth() + 1), desligamento: emp?.desligamento ?? "", faltas: "0", semanas: "0", atraso: "0", he50: "0", he100: "0", noturnas: "0", adiantamento: "0", dependentes: base.dependentes, vt: base.vt });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const ano = n(f.ano);
  const { tabela, aproximada } = tabelaDoAno(ano);
  const admissao = d(base.admissao);
  const r = useMemo(() => {
    if (!admissao) return null;
    return calcularFolhaMensal({
      ano, mes: n(f.mes), salario: n(base.salario), horasSemanais: n(base.horas), admissao, desligamento: d(f.desligamento), tabela,
      faltasInjustificadas: n(f.faltas), semanasComFalta: n(f.semanas), atrasoMinutos: n(f.atraso), horasExtras50: n(f.he50), horasExtras100: n(f.he100),
      horasNoturnas: n(f.noturnas), adiantamento: n(f.adiantamento), dependentesSalarioFamilia: n(f.dependentes), custoValeTransporte: n(f.vt),
    });
  }, [admissao, ano, f, base, tabela]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <CampoCalc rotulo="Mês" tipo="number" min={1} max={12} valor={f.mes} onChange={set("mes")} />
        <CampoCalc rotulo="Ano" tipo="number" valor={f.ano} onChange={set("ano")} />
        <CampoCalc rotulo="Desligamento (se houver)" tipo="date" valor={f.desligamento} onChange={set("desligamento")} />
        <CampoCalc rotulo="Faltas injustificadas (dias)" valor={f.faltas} onChange={set("faltas")} />
        <CampoCalc rotulo="Semanas com falta (DSR)" valor={f.semanas} onChange={set("semanas")} />
        <CampoCalc rotulo="Atrasos (minutos)" valor={f.atraso} onChange={set("atraso")} />
        <CampoCalc rotulo="Horas extras 50%" valor={f.he50} onChange={set("he50")} />
        <CampoCalc rotulo="Horas extras 100%" valor={f.he100} onChange={set("he100")} />
        <CampoCalc rotulo="Horas noturnas (convertidas)" valor={f.noturnas} onChange={set("noturnas")} />
        <CampoCalc rotulo="Adiantamento (R$)" valor={f.adiantamento} onChange={set("adiantamento")} />
        <CampoCalc rotulo="Filhos até 14 anos" valor={f.dependentes} onChange={set("dependentes")} />
        <CampoCalc rotulo="Custo do vale-transporte (R$)" valor={f.vt} onChange={set("vt")} />
      </div>
      <AvisoTabela aproximada={aproximada} ano={ano} />
      {!r ? <Aviso>Informe a data de admissão.</Aviso> : (
        <>
          <Resumo itens={[
            { rotulo: "Salário do mês", valor: formatarMoeda(r.proventos[0].valor) },
            { rotulo: "INSS do empregado", valor: formatarMoeda(r.encargos.inssEmpregado) },
            { rotulo: "Líquido a pagar", valor: formatarMoeda(r.liquido) },
            { rotulo: "INSS patronal + GILRAT", valor: formatarMoeda(r.encargos.inssPatronal + r.encargos.gilrat) },
            { rotulo: "FGTS + compensatório", valor: formatarMoeda(r.encargos.fgts + r.encargos.fgtsCompensatorio) },
            { rotulo: "Total do DAE", valor: formatarMoeda(r.encargos.totalDae), destaque: true },
          ]} />
          <MemoriaCalculo linhas={r.memoria.linhas} />
        </>
      )}
    </div>
  );
}

function AbaDecimo({ base, tabelaDoAno, hoje }: { base: Base; tabelaDoAno: TabelaFn; hoje: Date }) {
  const [f, setF] = useState({ ano: String(hoje.getUTCFullYear()), desligamento: "", media: "0", primeira: "" });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const ano = n(f.ano);
  const { tabela, aproximada } = tabelaDoAno(ano);
  const admissao = d(base.admissao);
  const r = admissao ? calcularDecimoTerceiro({ ano, salario: n(base.salario), admissao, desligamento: d(f.desligamento), mediaVariaveis: n(f.media), primeiraParcelaPaga: f.primeira ? n(f.primeira) : undefined, tabela }) : null;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <CampoCalc rotulo="Ano" tipo="number" valor={f.ano} onChange={set("ano")} />
        <CampoCalc rotulo="Desligamento (se houver)" tipo="date" valor={f.desligamento} onChange={set("desligamento")} />
        <CampoCalc rotulo="Média de extras/adicionais (R$)" valor={f.media} onChange={set("media")} />
        <CampoCalc rotulo="1ª parcela já paga (R$)" valor={f.primeira} onChange={set("primeira")} ajuda="Deixe vazio para calcular." />
      </div>
      <AvisoTabela aproximada={aproximada} ano={ano} />
      {!r ? <Aviso>Informe a data de admissão.</Aviso> : (
        <>
          <Resumo itens={[
            { rotulo: `Avos (${r.avos}/12)`, valor: formatarMoeda(r.total) },
            { rotulo: `1ª parcela (até ${formatarData(r.prazoPrimeira)})`, valor: formatarMoeda(r.primeiraParcela) },
            { rotulo: `2ª parcela (até ${formatarData(r.prazoSegunda)})`, valor: formatarMoeda(r.segundaParcela), destaque: true },
            { rotulo: "INSS do 13º", valor: formatarMoeda(r.inss) },
            { rotulo: "DAE do 13º", valor: formatarMoeda(r.dae.total) },
            { rotulo: "FGTS (1ª + 2ª)", valor: formatarMoeda(r.fgtsPrimeira + r.fgtsSegunda) },
          ]} />
          <div className="flex flex-wrap gap-1 text-xs">
            {r.detalhesAvos.map((m) => <span key={m.mes} className={`rounded px-2 py-1 ${m.conta ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"}`}>{m.nomeMes.slice(0, 3)}: {m.dias}d</span>)}
          </div>
          <MemoriaCalculo linhas={r.memoria.linhas} />
        </>
      )}
    </div>
  );
}

function AbaFerias({ base, emp, tabelaDoAno, hoje, regra }: { base: Base; emp?: EmpregadoCalc; tabelaDoAno: TabelaFn; hoje: Date; regra: "CLT" | "LC150" }) {
  const direito = diasDireitoFerias(base.regime as EmpregadoCalc["regime"], n(base.horas), 0, regra);
  const [f, setF] = useState({ dias: String(direito.dias), abono: "0", inicio: "", media: "0", faltas: "0", dobro: false });
  const set = (k: keyof typeof f) => (v: string | boolean) => setF({ ...f, [k]: v });
  const dirFaltas = diasDireitoFerias(base.regime as EmpregadoCalc["regime"], n(base.horas), n(f.faltas), regra);
  const inicio = d(f.inicio);
  const { tabela, aproximada } = tabelaDoAno((inicio ?? hoje).getUTCFullYear());
  const r = calcularFerias({ salario: n(base.salario), mediaVariaveis: n(f.media), diasGozo: n(f.dias), diasAbono: n(f.abono), inicioGozo: inicio ?? undefined, emDobro: f.dobro, tabela });
  const admissao = d(base.admissao);
  const periodos = admissao ? periodosFerias(admissao, hoje, (emp?.feriasGozadas ?? []).map((g) => ({ inicioAquisitivo: d(g.inicioAquisitivo)!, dias: g.dias })), dirFaltas.dias) : [];
  return (
    <div className="space-y-4">
      {periodos.length > 0 && (
        <Tabela cabecalho={["Aquisitivo", "Concessivo até", "Situação"]}>
          {periodos.map((x) => (
            <tr key={x.numero}>
              <Celula>{formatarData(x.inicioAquisitivo)} a {formatarData(x.fimAquisitivo)}</Celula>
              <Celula>{formatarData(x.fimConcessivo)}</Celula>
              <Celula><Selo cor={x.status === "VENCIDO" ? "vermelho" : x.status === "A_GOZAR" ? "amarelo" : x.status === "GOZADO" ? "verde" : "azul"}>{x.status.replace("_", " ").toLowerCase()}</Selo></Celula>
            </tr>
          ))}
        </Tabela>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <CampoCalc rotulo="Faltas injustificadas no período" valor={f.faltas} onChange={set("faltas")} ajuda={`Direito: ${dirFaltas.dias} dias — ${dirFaltas.fundamento}`} />
        <CampoCalc rotulo="Dias de gozo" valor={f.dias} onChange={set("dias")} />
        <CampoCalc rotulo="Dias de abono (venda de até 1/3)" valor={f.abono} onChange={set("abono")} />
        <CampoCalc rotulo="Início das férias" tipo="date" valor={f.inicio} onChange={set("inicio")} />
        <CampoCalc rotulo="Média de extras/adicionais (R$)" valor={f.media} onChange={set("media")} />
        <ChecaCalc rotulo="Fora do prazo (pagar em dobro)" valor={f.dobro} onChange={set("dobro")} />
      </div>
      <AvisoTabela aproximada={aproximada} ano={(inicio ?? hoje).getUTCFullYear()} />
      <Resumo itens={[
        { rotulo: "Férias", valor: formatarMoeda(r.ferias) },
        { rotulo: "1/3 constitucional", valor: formatarMoeda(r.terco) },
        { rotulo: "Abono + 1/3", valor: formatarMoeda(r.abono + r.tercoAbono) },
        { rotulo: "INSS", valor: formatarMoeda(r.inss) },
        { rotulo: "FGTS (no DAE)", valor: formatarMoeda(r.fgts) },
        { rotulo: "Líquido a pagar", valor: formatarMoeda(r.liquido), destaque: true },
      ]} />
      <MemoriaCalculo linhas={r.memoria.linhas} />
    </div>
  );
}

function AbaRescisao({ base, emp, tabelaDoAno, hoje }: { base: Base; emp?: EmpregadoCalc; tabelaDoAno: TabelaFn; hoje: Date }) {
  const [f, setF] = useState({ tipo: "SEM_JUSTA_CAUSA", data: iso(hoje), aviso: "INDENIZADO", media: "0", primeira: "0", banco: "0", saldoFgts: "", compensatorio: "", fimExp: "" });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const admissao = d(base.admissao);
  const desl = d(f.data);
  const { tabela, aproximada } = tabelaDoAno((desl ?? hoje).getUTCFullYear());
  const fimExp = d(f.fimExp) ?? (emp?.diasExperiencia && admissao ? new Date(admissao.getTime() + (emp.diasExperiencia - 1) * 86400000) : null);
  const r = admissao && desl && desl >= admissao ? calcularRescisao({
    tipo: f.tipo as TipoRescisao, admissao, desligamento: desl, salario: n(base.salario), horasSemanais: n(base.horas), tabela, mediaVariaveis: n(f.media),
    avisoPrevio: f.aviso as ModoAviso, primeiraParcela13Paga: n(f.primeira), saldoBancoHoras: n(f.banco),
    saldoFgts: f.saldoFgts ? n(f.saldoFgts) : undefined, fgtsCompensatorioAcumulado: f.compensatorio ? n(f.compensatorio) : undefined,
    fimExperiencia: fimExp ?? undefined,
    feriasGozadas: (emp?.feriasGozadas ?? []).map((g) => ({ inicioAquisitivo: d(g.inicioAquisitivo)!, dias: g.dias })),
    estabilidade: emp?.estabilidadeAte ? { motivo: emp.estabilidadeMotivo ?? "estabilidade", ate: d(emp.estabilidadeAte)! } : null,
  }) : null;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SelecaoCalc rotulo="Tipo de desligamento" valor={f.tipo} onChange={set("tipo")} opcoes={Object.entries(NOMES_RESCISAO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
        <CampoCalc rotulo="Último dia trabalhado" tipo="date" valor={f.data} onChange={set("data")} />
        <SelecaoCalc rotulo="Aviso prévio" valor={f.aviso} onChange={set("aviso")} opcoes={[{ valor: "INDENIZADO", rotulo: "Indenizado" }, { valor: "TRABALHADO", rotulo: "Trabalhado" }, { valor: "NAO_CUMPRIDO", rotulo: "Não cumprido (pedido de demissão)" }, { valor: "DISPENSADO", rotulo: "Dispensado pelo empregador" }]} />
        <CampoCalc rotulo="Média de extras/adicionais (R$)" valor={f.media} onChange={set("media")} />
        <CampoCalc rotulo="1ª parcela do 13º já paga (R$)" valor={f.primeira} onChange={set("primeira")} />
        <CampoCalc rotulo="Saldo do banco de horas (h)" valor={f.banco} onChange={set("banco")} />
        <CampoCalc rotulo="Saldo do FGTS 8% (R$)" valor={f.saldoFgts} onChange={set("saldoFgts")} ajuda="Opcional, do extrato." />
        <CampoCalc rotulo="FGTS compensatório acumulado (R$)" valor={f.compensatorio} onChange={set("compensatorio")} ajuda="Opcional; se vazio, é estimado." />
        <CampoCalc rotulo="Fim previsto da experiência" tipo="date" valor={f.fimExp} onChange={set("fimExp")} />
      </div>
      <AvisoTabela aproximada={aproximada} ano={(desl ?? hoje).getUTCFullYear()} />
      {!r ? <Aviso>Informe admissão e data de desligamento válidas.</Aviso> : (
        <>
          {r.bloqueio && <Aviso tipo="critico" titulo="Simulação bloqueada">{r.bloqueio}</Aviso>}
          {!r.bloqueio && (
            <>
              {r.alertas.map((a) => <Aviso key={a} tipo="aviso">{a}</Aviso>)}
              <Resumo itens={[
                { rotulo: "Proventos", valor: formatarMoeda(r.proventos) },
                { rotulo: "Descontos", valor: formatarMoeda(r.descontos) },
                { rotulo: "Líquido", valor: formatarMoeda(r.liquido), destaque: true },
                { rotulo: "Aviso prévio", valor: `${r.diasAviso} dias` },
                { rotulo: "DAE da rescisão", valor: formatarMoeda(r.dae.total) },
                { rotulo: "Pagar até", valor: formatarData(r.prazoPagamento) },
              ]} />
              <Aviso titulo="FGTS">{r.fgts.destino} {r.fgts.saque} Compensatório {r.fgts.compensatorioEstimado ? "estimado" : ""}: {formatarMoeda(r.fgts.compensatorio)}{r.fgts.saqueFgts !== null && ` · Saque: ${formatarMoeda(r.fgts.saqueFgts)}`}</Aviso>
              <MemoriaCalculo linhas={r.memoria.linhas} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function AbaRegularizacao({ base, tabelas, hoje, selic }: { base: Base; tabelas: PropsCalculadora["tabelas"]; hoje: Date; selic: number }) {
  const [f, setF] = useState({ inicio: base.admissao || iso(new Date(Date.UTC(hoje.getUTCFullYear() - 1, 0, 1))), fim: iso(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1))), pagamento: iso(hoje), remuneracao: base.salario, selic: String(selic).replace(".", ",") });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const ini = d(f.inicio);
  const fim = d(f.fim);
  const pag = d(f.pagamento);
  const r = ini && fim && pag && ini <= fim ? calcularRegularizacao({ competencias: competenciasEntre(ini, fim, n(f.remuneracao)), dataPagamento: pag, tabelas, selicMensal: n(f.selic), dae: escolherTabela(tabelas, pag.getUTCFullYear()).tabela.dae }) : null;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-5">
        <CampoCalc rotulo="Primeira competência" tipo="date" valor={f.inicio} onChange={set("inicio")} />
        <CampoCalc rotulo="Última competência" tipo="date" valor={f.fim} onChange={set("fim")} />
        <CampoCalc rotulo="Remuneração mensal (R$)" valor={f.remuneracao} onChange={set("remuneracao")} />
        <CampoCalc rotulo="Data do pagamento" tipo="date" valor={f.pagamento} onChange={set("pagamento")} />
        <CampoCalc rotulo="Selic mensal estimada (%)" valor={f.selic} onChange={set("selic")} />
      </div>
      {!r ? <Aviso>Informe um período válido.</Aviso> : (
        <>
          {r.avisos.map((a) => <Aviso key={a} tipo="aviso">{a}</Aviso>)}
          <Resumo itens={[
            { rotulo: `DAEs (${r.linhas.length})`, valor: formatarMoeda(r.totais.principal) },
            { rotulo: "Multa (0,33%/dia, máx. 20%)", valor: formatarMoeda(r.totais.multa) },
            { rotulo: "Juros Selic (estimados)", valor: formatarMoeda(r.totais.juros) },
            { rotulo: "Total estimado", valor: formatarMoeda(r.totais.total), destaque: true },
          ]} />
          <Tabela cabecalho={["Competência", "Vencimento", "DAE", "Atraso", "Multa", "Juros", "Total"]}>
            {r.linhas.map((l) => (
              <tr key={l.competencia}>
                <Celula>{l.competencia}</Celula>
                <Celula>{formatarData(l.vencimento)}</Celula>
                <Celula>{formatarMoeda(l.principal)}</Celula>
                <Celula>{l.dias} dias</Celula>
                <Celula>{formatarMoeda(l.multa)} ({l.percMulta}%)</Celula>
                <Celula>{formatarMoeda(l.juros)}</Celula>
                <Celula className="font-semibold">{formatarMoeda(l.total)}</Celula>
              </tr>
            ))}
          </Tabela>
          <MemoriaCalculo linhas={r.memoria.linhas.filter((x) => x.tipo === "texto" || x.destaque)} titulo="Observações" />
        </>
      )}
    </div>
  );
}
