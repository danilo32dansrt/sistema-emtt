import { BotaoAcao } from "@/components/Formulario";
import { Aviso, Campo, Cartao, Selecao, Selo, Titulo } from "@/components/ui";
import { formatarData, formatarMoeda, formatarNumero, hojeBrasil, isoData, type DefinicaoParametro, type FaixaInss } from "@/lib/calculos";
import { MESES_CONFERENCIA, situacaoParametros } from "@/lib/servicos/parametros";
import { excluirVigencia, marcarConferido } from "./acoes";
import { FormVigencia } from "./ImpactoMudanca";

export const metadata = { title: "Parâmetros legais" };

function mostrar(def: DefinicaoParametro, valor: unknown): string {
  if (valor === undefined || valor === null) return "—";
  if (def.tipo === "faixas") return (valor as FaixaInss[]).map((f) => `até ${formatarMoeda(f.ate)}: ${String(f.aliquota).replace(".", ",")}%`).join(" · ");
  if (def.tipo === "moeda") return formatarMoeda(Number(valor));
  if (def.tipo === "percentual") return `${String(valor).replace(".", ",")}%`;
  return String(valor).replace(".", ",");
}

function CamposValor({ def, valor }: { def: DefinicaoParametro; valor: unknown }) {
  if (def.tipo === "faixas") {
    const faixas = [...((valor as FaixaInss[]) ?? []), ...Array(6).fill(null)].slice(0, 6) as (FaixaInss | null)[];
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {faixas.map((f, i) => (
          <div key={i} className="flex gap-2">
            <Campo className="flex-1" rotulo={`Faixa ${i + 1}: até (R$)`} name={`faixa_ate_${i}`} inputMode="decimal" defaultValue={f ? formatarNumero(f.ate) : ""} />
            <Campo className="w-24" rotulo="%" name={`faixa_aliq_${i}`} inputMode="decimal" defaultValue={f ? String(f.aliquota).replace(".", ",") : ""} />
          </div>
        ))}
      </div>
    );
  }
  if (def.chave === "DAE_ARREDONDAMENTO") return <Selecao rotulo="Valor" name="valor" defaultValue={String(valor ?? "truncar")} opcoes={[{ valor: "truncar", rotulo: "Truncar (como o eSocial)" }, { valor: "arredondar", rotulo: "Arredondar" }]} />;
  return <Campo rotulo={`Novo valor${def.tipo === "percentual" ? " (%)" : def.tipo === "moeda" ? " (R$)" : ""}`} name="valor" inputMode="decimal" required defaultValue={valor !== undefined && valor !== null ? String(valor).replace(".", ",") : ""} />;
}

export default async function Parametros() {
  const hoje = hojeBrasil();
  const lista = await situacaoParametros(hoje);
  const grupos = [...new Set(lista.map((p) => p.def.grupo))];
  const pendentes = lista.filter((p) => p.pendente || !p.vigente || p.fonteMudou);
  return (
    <>
      <Titulo subtitulo="Todos os valores legais usados nos cálculos, com data de vigência, fonte oficial e conferência. Meses passados usam o valor vigente na época.">Parâmetros legais</Titulo>
      <div className="mb-4 space-y-2">
        {pendentes.length > 0 ? (
          <Aviso tipo="aviso" titulo={`${pendentes.length} parâmetro(s) precisam de conferência`}>
            Confira na fonte oficial e clique em “Conferido” (ou cadastre a nova vigência). O sistema avisa todo 2 de janeiro e sempre que um valor passa {MESES_CONFERENCIA} meses sem conferência.
          </Aviso>
        ) : <Aviso tipo="sucesso">Todos os parâmetros conferidos nos últimos {MESES_CONFERENCIA} meses.</Aviso>}
        <Aviso>Antes de usar com clientes, confira os valores atuais do Bolsa Família e do BPC no gov.br.</Aviso>
      </div>
      <div className="space-y-6">
        {grupos.map((g) => (
          <section key={g}>
            <h2 className="mb-2 text-lg font-bold">{g}</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {lista.filter((p) => p.def.grupo === g).map(({ def, historico, vigente, futuro, padrao, pendente, fonteUrl, fonteMudou }) => (
                <Cartao key={def.chave}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{def.rotulo}</p>
                      <p className="text-xs text-slate-500">{def.descricao}</p>
                    </div>
                    {!vigente ? <Selo cor="vermelho">usando valor padrão</Selo> : pendente ? <Selo cor="amarelo">conferir</Selo> : <Selo cor="verde">conferido</Selo>}
                  </div>
                  <p className="mt-2 text-xl font-bold text-marca-700">{mostrar(def, vigente?.valor ?? padrao?.valor)}</p>
                  <p className="text-xs text-slate-500">
                    {vigente ? `Vigente desde ${formatarData(vigente.vigenciaInicio)}` : "Ainda não cadastrado no banco"} · última conferência: {vigente?.ultimaConferencia ? formatarData(vigente.ultimaConferencia) : "nunca"}
                    {" · "}<a className="text-marca-700 underline" href={fonteUrl} target="_blank" rel="noreferrer">fonte oficial</a>
                  </p>
                  {futuro && <p className="mt-1 text-sm text-marca-700">Próxima vigência: {mostrar(def, futuro.valor)} a partir de {formatarData(futuro.vigenciaInicio)}</p>}
                  {fonteMudou && <div className="mt-2"><Aviso tipo="aviso">A página oficial mudou desde a última conferência. Confira se o valor foi alterado.</Aviso></div>}
                  {(vigente?.observacao || padrao?.observacao) && <p className="mt-1 text-xs italic text-slate-600">{vigente?.observacao ?? padrao?.observacao}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {vigente && <BotaoAcao acao={marcarConferido} campos={{ chave: def.chave }} variante="sucesso">✓ Conferido hoje</BotaoAcao>}
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-marca-700">Nova vigência / corrigir valor</summary>
                    <div className="mt-2">
                      <FormVigencia chave={def.chave}>
                        <CamposValor def={def} valor={vigente?.valor ?? padrao?.valor} />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Campo rotulo="Vale a partir de" name="vigenciaInicio" type="date" required defaultValue={vigente ? "" : isoData(padrao?.vigenciaInicio ?? hoje)} />
                          <Campo rotulo="Link da fonte oficial" name="fonteUrl" type="url" defaultValue={fonteUrl} />
                        </div>
                        <Campo rotulo="Observação (ex.: número da portaria)" name="observacao" />
                      </FormVigencia>
                    </div>
                  </details>
                  {historico.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-slate-600">Histórico ({historico.length})</summary>
                      <ul className="mt-2 space-y-1 text-sm">
                        {historico.map((h) => (
                          <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-1">
                            <span>desde {formatarData(h.vigenciaInicio)}: <strong>{mostrar(def, h.valor)}</strong>{h.observacao ? <span className="text-xs text-slate-500"> — {h.observacao}</span> : null}</span>
                            {historico.length > 1 && <BotaoAcao acao={excluirVigencia} campos={{ id: h.id }} confirmar="Excluir esta vigência? Os cálculos desse período passam a usar a vigência anterior.">Excluir</BotaoAcao>}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </Cartao>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
