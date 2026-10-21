import { decidirAjuste, decidirJustificativa } from "@/app/acoes-ponto";
import { formatarData } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { ROTULO_MARCACAO } from "@/lib/ponto/registro";
import { BotaoAcao } from "./Formulario";
import { Vazio } from "./ui";

/** Ajustes e justificativas aguardando decisão (consultor vê todos; cliente, só os seus). */
export async function PendenciasPonto({ clienteId }: { clienteId?: string }) {
  const filtro = { status: "PENDENTE" as const, ...(clienteId ? { empregado: { clienteId } } : {}) };
  const [ajustes, justificativas] = await Promise.all([
    prisma.ajustePonto.findMany({ where: filtro, include: { empregado: { select: { nome: true } } }, orderBy: { criadoEm: "asc" } }),
    prisma.justificativa.findMany({ where: filtro, include: { empregado: { select: { nome: true } } }, orderBy: { criadoEm: "asc" } }),
  ]);
  if (!ajustes.length && !justificativas.length) return <Vazio>Nenhum pedido aguardando decisão.</Vazio>;
  return (
    <ul className="space-y-3">
      {justificativas.map((j) => (
        <li key={j.id} className="rounded-xl border border-slate-200 p-3">
          <p className="font-semibold">{j.empregado.nome} — {j.tipo.toLowerCase().replace(/_/g, " ")}</p>
          <p className="text-sm text-slate-600">{formatarData(j.data)}{j.dataFim ? ` a ${formatarData(j.dataFim)}` : ""}: {j.descricao}</p>
          {j.arquivoId && <a className="text-sm font-semibold text-marca-700 underline" target="_blank" href={`/api/arquivos/${j.arquivoId}`}>Ver comprovante</a>}
          <div className="mt-2 flex gap-2">
            <BotaoAcao acao={decidirJustificativa} campos={{ id: j.id, decisao: "APROVADO" }} variante="sucesso">Aceitar</BotaoAcao>
            <BotaoAcao acao={decidirJustificativa} campos={{ id: j.id, decisao: "REJEITADO" }} variante="perigo" confirmar="Recusar esta justificativa?">Recusar</BotaoAcao>
          </div>
        </li>
      ))}
      {ajustes.map((a) => (
        <li key={a.id} className="rounded-xl border border-slate-200 p-3">
          <p className="font-semibold">{a.empregado.nome} — {a.tipo === "INCLUSAO" ? "incluir marcação esquecida" : "desconsiderar marcação"}</p>
          <p className="text-sm text-slate-600">
            {formatarData(a.data)}{a.dataHora ? ` às ${a.dataHora.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}` : ""}{a.tipoMarcacao ? ` (${ROTULO_MARCACAO[a.tipoMarcacao]})` : ""} — {a.justificativa}
          </p>
          <p className="text-xs text-slate-500">A marcação original nunca é apagada; o ajuste aprovado só muda o cálculo.</p>
          <div className="mt-2 flex gap-2">
            <BotaoAcao acao={decidirAjuste} campos={{ id: a.id, decisao: "APROVADO" }} variante="sucesso">Aprovar</BotaoAcao>
            <BotaoAcao acao={decidirAjuste} campos={{ id: a.id, decisao: "REJEITADO" }} variante="perigo" confirmar="Rejeitar este ajuste?">Rejeitar</BotaoAcao>
          </div>
        </li>
      ))}
    </ul>
  );
}
