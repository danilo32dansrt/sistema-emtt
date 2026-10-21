"use client";

import { useState, useTransition } from "react";
import { gerarPdfBeneficios } from "@/app/acoes-beneficios";
import { formatarMoeda, simularBeneficiosSociais, type ParametrosSociais, type PessoaFamilia, type TabelaAnual } from "@/lib/calculos";
import { Aviso } from "../ui";
import { CampoCalc, ChecaCalc, n } from "./campos";

const ROTULO_SITUACAO = {
  integral: { texto: "Continua integral", cor: "bg-emerald-100 text-emerald-800" },
  protecao: { texto: "Regra de proteção", cor: "bg-amber-100 text-amber-800" },
  fora: { texto: "Sai do programa", cor: "bg-red-100 text-red-800" },
  nao_recebe: { texto: "Não recebe", cor: "bg-slate-100 text-slate-700" },
} as const;

interface PessoaForm {
  nome: string;
  idade: string;
  renda: string;
  ehEmpregada?: boolean;
  gestante?: boolean;
  nutriz?: boolean;
  recebeBpc?: boolean;
  valorBpc: string;
}

/** Simulador para mostrar à empregada: carteira assinada x sem carteira e os benefícios sociais. */
export function SimuladorBeneficios({ params, tabela, salarioInicial }: { params: ParametrosSociais; tabela: TabelaAnual; salarioInicial?: number }) {
  const [nome, setNome] = useState("");
  const [salario, setSalario] = useState(String(salarioInicial ?? params.salarioMinimo).replace(".", ","));
  const [recebeBolsa, setRecebeBolsa] = useState(true);
  const [valorBolsa, setValorBolsa] = useState("");
  const [pessoas, setPessoas] = useState<PessoaForm[]>([
    { nome: "Ela (trabalhadora)", idade: "35", renda: "0", ehEmpregada: true, valorBpc: "" },
    { nome: "Filho(a)", idade: "8", renda: "0", valorBpc: "" },
  ]);
  const [pdfPendente, iniciar] = useTransition();
  const [erroPdf, setErroPdf] = useState<string | null>(null);

  const entrada = {
    nome,
    salarioProposto: n(salario),
    recebeBolsaFamilia: recebeBolsa,
    valorBolsaFamilia: valorBolsa ? n(valorBolsa) : undefined,
    pessoas: pessoas.map<PessoaFamilia>((p) => ({ nome: p.nome, idade: Math.max(0, Math.round(n(p.idade))), renda: n(p.renda), ehEmpregada: p.ehEmpregada, gestante: p.gestante, nutriz: p.nutriz, recebeBpc: p.recebeBpc, valorBpc: p.recebeBpc ? (p.valorBpc ? n(p.valorBpc) : params.salarioMinimo) : undefined })),
  };
  const r = simularBeneficiosSociais({ ...entrada, params, tabela });

  const alterar = (i: number, campo: keyof PessoaForm, valor: string | boolean) => setPessoas(pessoas.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));

  const textoWhatsapp = [
    `*Carteira assinada: o que muda${nome ? ` para ${nome}` : ""}*`,
    `Salário na carteira: ${formatarMoeda(n(salario))} (você recebe ${formatarMoeda(r.liquido)} já sem o INSS).`,
    `Bolsa Família: ${r.comCarteira.bolsaFamilia.explicacao}`,
    ...r.alertasBpc.map((a) => `BPC: ${a}`),
    `Ganho em 12 meses: ${formatarMoeda(r.ganho12.diferenca)} a mais + ${formatarMoeda(r.ganho12.fgts)} no FGTS.`,
    `Ganho em 5 anos: ${formatarMoeda(r.ganho60.diferenca)} a mais + ${formatarMoeda(r.ganho60.fgts)} no FGTS.`,
    `Direitos: 13º, férias + 1/3, FGTS, seguro-desemprego, aposentadoria, auxílio-doença, licença-maternidade.`,
    `Lembre de atualizar o CadÚnico com a nova renda.`,
    `_${r.aviso}_`,
  ].join("\n\n");

  async function baixarPdf() {
    setErroPdf(null);
    iniciar(async () => {
      const res = await gerarPdfBeneficios(entrada);
      if (!res.pdf) return setErroPdf(res.erro ?? "Não foi possível gerar o PDF.");
      const bytes = Uint8Array.from(atob(res.pdf), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `simulacao-beneficios${nome ? `-${nome}` : ""}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  }

  return (
    <div className="space-y-4">
      <Aviso tipo="aviso">{r.aviso}</Aviso>

      <div className="grid gap-3 sm:grid-cols-3">
        <CampoCalc rotulo="Nome da trabalhadora (opcional)" tipo="text" valor={nome} onChange={setNome} />
        <CampoCalc rotulo="Salário proposto na carteira (R$)" valor={salario} onChange={setSalario} />
        <div className="space-y-2">
          <ChecaCalc rotulo="A família recebe Bolsa Família" valor={recebeBolsa} onChange={setRecebeBolsa} />
          {recebeBolsa && <CampoCalc rotulo="Valor atual (vazio = estimar)" valor={valorBolsa} onChange={setValorBolsa} ajuda={`Estimativa pela família: ${formatarMoeda(r.estimativaBolsa.valor)}`} />}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-3">
        <p className="mb-2 font-semibold">Quem mora na casa (como no CadÚnico)</p>
        <p className="mb-3 text-xs text-slate-500">Informe a renda bruta de cada pessoa (trabalho, pensão, aposentadoria). Na trabalhadora, coloque quanto ela ganha hoje sem carteira — toda renda deve estar no CadÚnico.</p>
        <div className="space-y-3">
          {pessoas.map((p, i) => (
            <div key={i} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[2fr_1fr_1.5fr_auto]">
              <CampoCalc rotulo="Pessoa" tipo="text" valor={p.nome} onChange={(v) => alterar(i, "nome", v)} />
              <CampoCalc rotulo="Idade" valor={p.idade} onChange={(v) => alterar(i, "idade", v)} />
              <CampoCalc rotulo={p.ehEmpregada ? "Renda hoje, sem carteira (R$)" : "Renda (R$)"} valor={p.renda} onChange={(v) => alterar(i, "renda", v)} />
              {!p.ehEmpregada && <button type="button" onClick={() => setPessoas(pessoas.filter((_, j) => j !== i))} className="min-h-12 self-end rounded-xl border border-slate-300 px-3 text-sm">Remover</button>}
              <div className="flex flex-wrap gap-3 text-sm sm:col-span-4">
                <label className="flex items-center gap-1"><input type="checkbox" checked={!!p.gestante} onChange={(e) => alterar(i, "gestante", e.target.checked)} /> gestante</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={!!p.nutriz} onChange={(e) => alterar(i, "nutriz", e.target.checked)} /> amamentando (bebê até 6 meses)</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={!!p.recebeBpc} onChange={(e) => alterar(i, "recebeBpc", e.target.checked)} /> recebe BPC</label>
                {p.recebeBpc && <input aria-label="Valor do BPC" placeholder={`BPC (padrão ${formatarMoeda(params.salarioMinimo)})`} value={p.valorBpc} onChange={(e) => alterar(i, "valorBpc", e.target.value)} className="min-h-9 rounded-lg border border-slate-300 px-2" inputMode="decimal" />}
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setPessoas([...pessoas, { nome: "Outra pessoa", idade: "30", renda: "0", valorBpc: "" }])} className="mt-3 min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-semibold">+ Adicionar pessoa</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {([["Sem carteira (hoje)", r.semCarteira], ["Com carteira assinada", r.comCarteira]] as const).map(([titulo, c], i) => {
          const s = ROTULO_SITUACAO[c.bolsaFamilia.situacao];
          return (
            <div key={titulo} className={`rounded-2xl border-2 p-4 ${i === 1 ? "border-marca-500 bg-marca-50" : "border-slate-200 bg-white"}`}>
              <p className="text-lg font-bold">{titulo}</p>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between"><dt>Ela recebe por mês</dt><dd className="font-semibold">{formatarMoeda(c.rendaEmpregadaLiquida)}</dd></div>
                <div className="flex justify-between"><dt>Renda da família</dt><dd>{formatarMoeda(c.rendaFamiliar)}</dd></div>
                <div className="flex justify-between"><dt>Renda por pessoa</dt><dd className="font-semibold">{formatarMoeda(c.rendaPerCapita)}</dd></div>
                <div className="flex items-center justify-between"><dt>Bolsa Família</dt><dd><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.cor}`}>{s.texto}</span> {formatarMoeda(c.bolsaFamilia.valorMensal)}</dd></div>
                <div className="flex justify-between border-t border-slate-200 pt-1 text-base"><dt className="font-semibold">Total da família no mês</dt><dd className="font-bold">{formatarMoeda(c.totalMensalFamilia)}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-slate-600">{c.bolsaFamilia.explicacao}</p>
            </div>
          );
        })}
      </div>

      {r.alertasBpc.map((a) => <Aviso key={a} tipo="aviso" titulo="BPC">{a}</Aviso>)}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-emerald-600 p-4 text-white">
          <p className="text-sm text-emerald-100">Ganho em 12 meses</p>
          <p className="text-2xl font-bold">{formatarMoeda(r.ganho12.diferenca)}</p>
          <p className="text-xs text-emerald-100">+ {formatarMoeda(r.ganho12.fgts)} guardados no FGTS</p>
        </div>
        <div className="rounded-2xl bg-emerald-700 p-4 text-white">
          <p className="text-sm text-emerald-100">Ganho em 5 anos</p>
          <p className="text-2xl font-bold">{formatarMoeda(r.ganho60.diferenca)}</p>
          <p className="text-xs text-emerald-100">+ {formatarMoeda(r.ganho60.fgts)} guardados no FGTS</p>
        </div>
      </div>
      <p className="text-xs text-slate-500">Valores de hoje, sem reajustes. Inclui salário líquido, 13º, 1/3 de férias e o Bolsa Família de cada cenário.</p>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 font-semibold">✅ Direitos que ela ganha</p>
          <ul className="space-y-2 text-sm">{r.direitos.map((d) => <li key={d.titulo}><strong>{d.titulo}:</strong> {d.texto}</li>)}</ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 font-semibold">📋 Deveres</p>
          <ul className="space-y-2 text-sm">{r.deveres.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={baixarPdf} disabled={pdfPendente} className="min-h-12 rounded-xl bg-marca-600 px-5 font-semibold text-white disabled:bg-slate-400">{pdfPendente ? "Gerando..." : "Baixar PDF"}</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(textoWhatsapp)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center rounded-xl bg-[#25D366] px-5 font-semibold text-white">Enviar resumo por WhatsApp</a>
      </div>
      {erroPdf && <Aviso tipo="critico">{erroPdf}</Aviso>}
      <p className="text-sm font-semibold">{r.aviso}</p>
    </div>
  );
}
