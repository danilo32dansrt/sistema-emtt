import Link from "next/link";
import { formatarData, NOMES_MEDIDA, tipoFalta, type Medida } from "@/lib/calculos";
import { painelDisciplinar, STATUS_DISCIPLINAR } from "@/lib/servicos/disciplinar";
import { Aviso, Cartao, Celula, Selo, Tabela, Vazio } from "../ui";

export async function PainelDisciplinar({ clienteId, base }: { clienteId?: string; base: string }) {
  const { ocorrencias, alertas, riscos } = await painelDisciplinar(clienteId);
  return (
    <div className="space-y-4">
      <Aviso tipo="aviso">As recomendações são orientativas e não substituem análise de advogado em casos graves.</Aviso>
      {alertas.length > 0 && (
        <Cartao titulo="Alertas">
          <ul className="space-y-2">{alertas.map((a, i) => <li key={i}><Link href={`${base}/${a.ocorrenciaId}`} className="block"><Aviso tipo={a.tipo === "critico" ? "critico" : a.tipo === "aviso" ? "aviso" : "info"}>{a.texto}</Aviso></Link></li>)}</ul>
        </Cartao>
      )}
      <Cartao titulo="Risco por empregado">
        {!riscos.length ? <Vazio>Nenhuma ocorrência registrada.</Vazio> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {riscos.map((r) => (
              <div key={r.empregadoId} className="rounded-xl border border-slate-200 p-3">
                <p className="font-semibold">{r.nome}</p>
                {!clienteId && <p className="text-xs text-slate-500">{r.cliente}</p>}
                <p className="mt-1"><Selo cor={r.nivel === "alto" ? "vermelho" : r.nivel === "medio" ? "amarelo" : "verde"}>risco {r.nivel === "medio" ? "médio" : r.nivel}</Selo> <span className="text-xs text-slate-500">{r.pontos.toLocaleString("pt-BR")} pontos · {r.ocorrencias.length} ocorrência(s)</span></p>
              </div>
            ))}
          </div>
        )}
      </Cartao>
      <Cartao titulo="Ocorrências">
        <Tabela cabecalho={["Data", "Empregado", "Falta", "Medida", "Situação"]} vazio="Nenhuma ocorrência.">
          {ocorrencias.map((o) => {
            const st = STATUS_DISCIPLINAR[o.status];
            return (
              <tr key={o.id}>
                <Celula className="whitespace-nowrap">{formatarData(o.dataFato)}</Celula>
                <Celula><Link className="font-semibold text-marca-700" href={`${base}/${o.id}`}>{o.empregado.nome}</Link>{!clienteId && <span className="block text-xs text-slate-500">{o.cliente.nome}</span>}</Celula>
                <Celula>{tipoFalta(o.tipoFalta).rotulo}</Celula>
                <Celula>{o.medida ? NOMES_MEDIDA[o.medida as Medida | "NENHUMA"] : "—"}{o.medida === "SUSPENSAO" ? ` (${o.diasSuspensao}d)` : ""}</Celula>
                <Celula><Selo cor={st?.cor ?? "cinza"}>{st?.rotulo ?? o.status}</Selo></Celula>
              </tr>
            );
          })}
        </Tabela>
      </Cartao>
    </div>
  );
}
