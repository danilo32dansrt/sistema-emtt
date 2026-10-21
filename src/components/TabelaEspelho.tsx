import { formatarData, formatarNumero, minutosParaHora, NOMES_DIAS_SEMANA, DIAS_SEMANA, type ResultadoDia } from "@/lib/calculos";
import { Celula, Tabela } from "./ui";

/** Tabela diária do espelho de ponto. */
export function TabelaEspelho({ dias }: { dias: ResultadoDia[] }) {
  return (
    <Tabela cabecalho={["Dia", "Marcações", "Trabalhado", "Extras", "Noturno", "Falta/atraso", "Ocorrências"]}>
      {dias.map((d) => (
        <tr key={d.data.toISOString()} className={d.falta ? "bg-red-50" : d.domingoOuFeriado ? "bg-slate-50" : undefined}>
          <Celula className="whitespace-nowrap">{formatarData(d.data).slice(0, 5)} <span className="text-xs text-slate-500">{NOMES_DIAS_SEMANA[DIAS_SEMANA[d.data.getUTCDay()]].slice(0, 3)}</span></Celula>
          <Celula className="whitespace-nowrap text-xs">{d.pares.map((p) => `${p.entrada}–${p.saida}`).join(" · ") || (d.faltaJustificada ? "abonado" : d.previsto ? "—" : "folga")}</Celula>
          <Celula className="tabular-nums">{d.trabalhadoComputado ? minutosParaHora(d.trabalhadoComputado) : ""}</Celula>
          <Celula className="tabular-nums">{d.extras50 ? `${minutosParaHora(d.extras50)} (50%)` : ""}{d.extras100 ? `${minutosParaHora(d.extras100)} (100%)` : ""}</Celula>
          <Celula className="tabular-nums">{d.noturnoReal ? `${formatarNumero(d.noturnoConvertido / 60)} h` : ""}</Celula>
          <Celula>{d.falta ? "Falta" : d.atraso ? minutosParaHora(d.atraso) : ""}</Celula>
          <Celula className="text-xs text-amber-800">{d.inconsistencias.join(" ")}</Celula>
        </tr>
      ))}
    </Tabela>
  );
}
