import { Formulario } from "@/components/Formulario";
import { AreaTexto, Aviso, Campo, Cartao, Grade, Selecao, Titulo } from "@/components/ui";
import { formatarNumero, hojeBrasil, type TabelaAnual } from "@/lib/calculos";
import { todasTabelas } from "@/lib/tabelas-db";
import { salvarTabela } from "./acoes";

export const metadata = { title: "Tabelas anuais" };

function FormTabela({ t, novo }: { t: TabelaAnual; novo?: boolean }) {
  const faixas = [...t.faixasInss, ...Array(Math.max(0, 6 - t.faixasInss.length)).fill(null)].slice(0, 6);
  return (
    <Formulario acao={salvarTabela} textoBotao={novo ? "Criar tabela" : `Salvar ${t.ano}`}>
      {novo ? <Campo rotulo="Ano" name="ano" type="number" required defaultValue={t.ano} /> : <input type="hidden" name="ano" value={t.ano} />}
      <Grade colunas={3}>
        <Campo rotulo="Salário mínimo (R$)" name="salarioMinimo" inputMode="decimal" required defaultValue={formatarNumero(t.salarioMinimo)} />
        <Campo rotulo="Salário-família: limite (R$)" name="salarioFamiliaLimite" inputMode="decimal" defaultValue={formatarNumero(t.salarioFamiliaLimite)} />
        <Campo rotulo="Salário-família: cota (R$)" name="salarioFamiliaCota" inputMode="decimal" defaultValue={formatarNumero(t.salarioFamiliaCota)} />
      </Grade>
      <p className="text-sm font-semibold">Faixas do INSS (tabela progressiva)</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {faixas.map((f, i) => (
          <div key={i} className="flex gap-2">
            <Campo className="flex-1" rotulo={`Faixa ${i + 1}: até (R$)`} name={`faixa_ate_${i}`} inputMode="decimal" defaultValue={f ? formatarNumero(f.ate) : ""} />
            <Campo className="w-28" rotulo="Alíquota %" name={`faixa_aliq_${i}`} inputMode="decimal" defaultValue={f ? String(f.aliquota).replace(".", ",") : ""} />
          </div>
        ))}
      </div>
      <Grade colunas={4}>
        <Campo rotulo="INSS patronal %" name="inssPatronal" inputMode="decimal" defaultValue={String(t.aliquotas.inssPatronal).replace(".", ",")} />
        <Campo rotulo="GILRAT %" name="gilrat" inputMode="decimal" defaultValue={String(t.aliquotas.gilrat).replace(".", ",")} />
        <Campo rotulo="FGTS %" name="fgts" inputMode="decimal" defaultValue={String(t.aliquotas.fgts).replace(".", ",")} />
        <Campo rotulo="FGTS compensatório %" name="fgtsCompensatorio" inputMode="decimal" defaultValue={String(t.aliquotas.fgtsCompensatorio).replace(".", ",")} />
      </Grade>
      <Selecao rotulo="Centavos no DAE" name="arredondamentoDae" defaultValue={t.arredondamentoDae} opcoes={[{ valor: "truncar", rotulo: "Truncar (como o eSocial)" }, { valor: "arredondar", rotulo: "Arredondar" }]} />
      <AreaTexto rotulo="Observações / fonte (portaria, decreto)" name="observacoes" />
    </Formulario>
  );
}

export default async function Tabelas() {
  const tabelas = (await todasTabelas()).sort((a, b) => b.ano - a.ano);
  const anoAtual = hojeBrasil().getUTCFullYear();
  const ultima = tabelas[0];
  return (
    <>
      <Titulo subtitulo="Salário mínimo, INSS e salário-família por ano. Atualize todo mês de janeiro, sem mexer no código.">Tabelas anuais</Titulo>
      {!tabelas.some((t) => t.ano === anoAtual) && <div className="mb-4"><Aviso tipo="critico">Não há tabela de {anoAtual}. Os cálculos estão usando a de {ultima?.ano}.</Aviso></div>}
      <div className="space-y-4">
        <Cartao titulo="Novo ano">
          <details>
            <summary className="cursor-pointer font-semibold text-marca-700">Criar tabela de {ultima ? ultima.ano + 1 : anoAtual} (copiando a anterior)</summary>
            <div className="mt-3">{ultima && <FormTabela t={{ ...ultima, ano: ultima.ano + 1 }} novo />}</div>
          </details>
        </Cartao>
        {tabelas.map((t) => (
          <Cartao key={t.ano} titulo={`${t.ano}${t.ano === anoAtual ? " (vigente)" : ""}`}>
            <details open={t.ano === anoAtual}>
              <summary className="cursor-pointer text-sm text-slate-600">Salário mínimo R$ {formatarNumero(t.salarioMinimo)} · teto INSS R$ {formatarNumero(t.faixasInss.at(-1)?.ate ?? 0)} — clique para editar</summary>
              <div className="mt-3"><FormTabela t={t} /></div>
            </details>
          </Cartao>
        ))}
      </div>
    </>
  );
}
