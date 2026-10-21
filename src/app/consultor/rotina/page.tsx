import Link from "next/link";
import { BotaoAcao, Formulario } from "@/components/Formulario";
import { Campo, Cartao, Grade, Indicador, Selo, Titulo, Vazio } from "@/components/ui";
import {
  competenciaAnterior, ETAPAS_CHECKLIST, formatarCompetencia, formatarData, formatarMoeda, formatarNumero, hojeBrasil, nomeMes, prazosChecklist, proximaCompetencia, situacaoChecklist,
} from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { lerCompetencia } from "@/lib/servicos/competencia";
import { folhaDoMes } from "@/lib/servicos/folha";
import { linkWhatsapp, preencherModelo } from "@/lib/whatsapp";
import { modelosMensagem } from "@/lib/tabelas-db";
import { alternarEtapa, salvarDae, salvarLancamentoConsultor } from "./acoes";

export const metadata = { title: "Rotina mensal" };

export default async function Rotina({ searchParams }: { searchParams: Promise<{ ano?: string; mes?: string; filtro?: string }> }) {
  const sp = await searchParams;
  const { ano, mes } = lerCompetencia(sp);
  const filtro = sp.filtro ?? "todos";
  const hoje = hojeBrasil();
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 0));
  const prazos = prazosChecklist(ano, mes);
  const empregados = await prisma.empregado.findMany({
    where: { admissao: { lte: fim }, OR: [{ desligamento: null }, { desligamento: { gte: inicio } }], cliente: { ativo: true, anonimizadoEm: null } },
    include: {
      cliente: { select: { id: true, nome: true, telefone: true } },
      competencias: { where: { ano, mes } },
      lancamentos: { where: { ano, mes } },
    },
    orderBy: [{ cliente: { nome: "asc" } }, { nome: "asc" }],
  });
  const modeloDae = (await modelosMensagem()).find((m) => m.chave === "enviar_dae")!;

  const linhas = await Promise.all(
    empregados.map(async (e) => {
      const c = e.competencias[0];
      const l = e.lancamentos[0];
      const s = situacaoChecklist(ano, mes, c ?? {}, hoje);
      const { folha } = await folhaDoMes(e, ano, mes, l);
      return { e, c, l, s, folha };
    }),
  );
  const visiveis = linhas.filter((x) => filtro === "todos" || (filtro === "atrasados" ? x.s.status === "atrasado" : x.s.status !== "ok"));
  const ant = competenciaAnterior(ano, mes);
  const prox = proximaCompetencia(ano, mes);
  const link = (a: number, m: number, f = filtro) => `/consultor/rotina?ano=${a}&mes=${m}&filtro=${f}`;

  return (
    <>
      <Titulo
        subtitulo={`Informações do cliente até ${formatarData(prazos.infoRecebida)} · guias até ${formatarData(prazos.daeEmitido)} · DAE vence em ${formatarData(prazos.pagamentoConfirmado)}`}
        acoes={
          <>
            <Link className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold" href={link(ant.ano, ant.mes)}>← {formatarCompetencia(ant.ano, ant.mes)}</Link>
            <Link className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold" href={link(prox.ano, prox.mes)}>{formatarCompetencia(prox.ano, prox.mes)} →</Link>
          </>
        }
      >
        Rotina de {nomeMes(mes)}/{ano}
      </Titulo>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Indicador rotulo="Concluídos" valor={linhas.filter((x) => x.s.status === "ok").length} cor="verde" href={link(ano, mes, "todos")} />
        <Indicador rotulo="Em andamento" valor={linhas.filter((x) => x.s.status === "pendente").length} cor="amarelo" href={link(ano, mes, "pendentes")} />
        <Indicador rotulo="Atrasados" valor={linhas.filter((x) => x.s.status === "atrasado").length} cor="vermelho" href={link(ano, mes, "atrasados")} />
      </div>

      {visiveis.length === 0 ? <Vazio>Nenhum empregado nesta visão.</Vazio> : (
        <div className="space-y-4">
          {visiveis.map(({ e, c, l, s, folha }) => {
            const valorDae = c?.daeValor ? num(c.daeValor) : folha.encargos.totalDae;
            const msg = preencherModelo(modeloDae.texto, { nome: e.cliente.nome.split(" ")[0], "mês": `${nomeMes(mes)}/${ano}`, mes: `${nomeMes(mes)}/${ano}`, valor: formatarMoeda(valorDae), data: formatarData(s.vencimentoDae) });
            return (
              <Cartao key={e.id} className={s.status === "atrasado" ? "border-red-300" : undefined}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/consultor/empregados/${e.id}`} className="text-lg font-semibold text-marca-700">{e.nome}</Link>
                    <p className="text-sm text-slate-600"><Link href={`/consultor/clientes/${e.cliente.id}`}>{e.cliente.nome}</Link> · {formatarMoeda(num(e.salario))}</p>
                  </div>
                  <Selo cor={s.status === "ok" ? "verde" : s.status === "atrasado" ? "vermelho" : "amarelo"}>{s.status === "ok" ? "concluído" : s.status === "atrasado" ? `${s.atrasadas.length} atrasada(s)` : `${s.concluidas}/${s.total}`}</Selo>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ETAPAS_CHECKLIST.map((etapa, i) => {
                    const feito = Boolean(c?.[etapa.campo]);
                    const atrasada = s.atrasadas.includes(etapa.campo);
                    return (
                      <BotaoAcao key={etapa.campo} acao={alternarEtapa} campos={{ empregadoId: e.id, ano: String(ano), mes: String(mes), campo: etapa.campo, valor: String(!feito) }} variante={feito ? "sucesso" : atrasada ? "perigo" : "secundario"}>
                        {feito ? "✓" : `${i + 1}.`} {etapa.curto}
                      </BotaoAcao>
                    );
                  })}
                </div>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">DAE {c?.daeValor ? "informado" : "estimado"}</p>
                    <p className="text-xl font-bold">{formatarMoeda(valorDae)}</p>
                    {c?.daeCodigo && <p className="text-xs text-slate-500">Código: {c.daeCodigo}</p>}
                    {c?.daeValor && Math.abs(num(c.daeValor) - folha.encargos.totalDae) > 0.05 && <p className="text-xs text-amber-700">Estimativa do sistema: {formatarMoeda(folha.encargos.totalDae)}</p>}
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Informações do mês {l ? `(${l.origem.toLowerCase()})` : ""}</p>
                    {l ? (
                      <p>Faltas: {l.faltasInjustificadas} · HE: {formatarNumero(num(l.horasExtras50) + num(l.horasExtras100))}h · Adiant.: {formatarMoeda(num(l.adiantamento))}{l.observacoes && <span className="block text-xs text-slate-500">{l.observacoes}</span>}</p>
                    ) : <p className="text-slate-500">Ainda não recebidas.</p>}
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Líquido estimado</p>
                    <p className="text-xl font-bold">{formatarMoeda(folha.liquido)}</p>
                    {c?.clienteInformouPagamentoEm && <p className="text-xs text-emerald-700">Cliente informou pagamento em {c.clienteInformouPagamentoEm.toLocaleDateString("pt-BR")}{c.comprovanteArquivoId && <> — <a className="underline" href={`/api/arquivos/${c.comprovanteArquivoId}`}>comprovante</a></>}</p>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {e.cliente.telefone && <a href={linkWhatsapp(e.cliente.telefone, msg)} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white">💬 Enviar DAE</a>}
                  <Link href={`/consultor/calculadora?empregado=${e.id}&ano=${ano}&mes=${mes}`} className="inline-flex min-h-9 items-center rounded-xl border border-slate-300 px-3 text-sm font-semibold">🧮 Memória de cálculo</Link>
                </div>
                <details className="mt-3 rounded-xl border border-slate-200 p-3">
                  <summary className="cursor-pointer font-semibold text-marca-700">Lançar informações / registrar DAE</summary>
                  <div className="mt-3 grid gap-4 lg:grid-cols-2">
                    <Formulario acao={salvarLancamentoConsultor} textoBotao="Salvar informações" variante="secundario">
                      <input type="hidden" name="empregadoId" value={e.id} />
                      <input type="hidden" name="ano" value={ano} />
                      <input type="hidden" name="mes" value={mes} />
                      <Campo rotulo="Datas das faltas injustificadas" name="datasFaltas" placeholder="ex.: 05/03, 12/03" ajuda="O sistema conta as semanas para descontar o DSR." />
                      <Grade>
                        <Campo rotulo="Faltas justificadas (dias)" name="faltasJustificadas" type="number" min={0} defaultValue={l?.faltasJustificadas ?? 0} />
                        <Campo rotulo="Atrasos (minutos)" name="atrasoMinutos" type="number" min={0} defaultValue={l?.atrasoMinutos ?? 0} />
                        <Campo rotulo="Horas extras 50%" name="horasExtras50" inputMode="decimal" defaultValue={l ? formatarNumero(num(l.horasExtras50)) : "0"} />
                        <Campo rotulo="Horas extras 100%" name="horasExtras100" inputMode="decimal" defaultValue={l ? formatarNumero(num(l.horasExtras100)) : "0"} />
                        <Campo rotulo="Horas noturnas" name="horasNoturnas" inputMode="decimal" defaultValue={l ? formatarNumero(num(l.horasNoturnas)) : "0"} />
                        <Campo rotulo="Adiantamento (R$)" name="adiantamento" inputMode="decimal" defaultValue={l ? formatarNumero(num(l.adiantamento)) : "0"} />
                      </Grade>
                      <Campo rotulo="Observações" name="observacoes" />
                    </Formulario>
                    <Formulario acao={salvarDae} textoBotao="Registrar DAE emitido" variante="secundario">
                      <input type="hidden" name="empregadoId" value={e.id} />
                      <input type="hidden" name="ano" value={ano} />
                      <input type="hidden" name="mes" value={mes} />
                      <Campo rotulo="Valor do DAE (R$)" name="daeValor" inputMode="decimal" required defaultValue={formatarNumero(valorDae)} />
                      <Campo rotulo="Código de barras / número do documento" name="daeCodigo" defaultValue={c?.daeCodigo ?? ""} />
                      <Campo rotulo="PDF do DAE (opcional)" name="arquivo" type="file" accept="application/pdf,image/*" />
                    </Formulario>
                  </div>
                </details>
              </Cartao>
            );
          })}
        </div>
      )}
    </>
  );
}
