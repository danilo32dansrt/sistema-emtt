import type { PendenciaComAcoes } from "@/lib/servicos/lembretes";
import { Pendencias } from "./Pendencias";
import { TelaAlerta } from "./TelaAlerta";

/** Pendências em alerta de tela cheia (urgentes primeiro). Usado no layout dos três apps. */
export function AlertaPendencias({ itens }: { itens: PendenciaComAcoes[] }) {
  if (!itens.length) return null;
  const ordenadas = [...itens].sort((a, b) => Number(Boolean(b.urgente)) - Number(Boolean(a.urgente)));
  return (
    <TelaAlerta chaves={ordenadas.map((p) => p.chave)} urgente={ordenadas.some((p) => p.urgente && p.chave.startsWith("sos:"))} total={ordenadas.length}>
      <Pendencias itens={ordenadas} titulo="Resolva agora" />
    </TelaAlerta>
  );
}
