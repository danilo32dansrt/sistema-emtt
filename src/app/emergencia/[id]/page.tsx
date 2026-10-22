import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pendencias } from "@/components/Pendencias";
import { registrarAtividade } from "@/lib/atividade";
import { usuarioAtual } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { alertasDeEmergencia } from "@/lib/servicos/emergencia";

export const metadata = { title: "Emergência" };
export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Emergência (SOS): local, linha do tempo e gravações. Patrões do cliente e consultor. */
export default async function PaginaEmergencia({ params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioAtual();
  const { id } = await params;
  if (!u) redirect(`/login?voltar=/emergencia/${id}`);
  const em = await prisma.emergencia.findUnique({ where: { id }, include: { empregado: { select: { nome: true } }, trechos: { orderBy: { ordem: "asc" } } } });
  if (!em || !(u.papel === "CONSULTOR" || (u.papel === "CLIENTE" && u.clienteId === em.clienteId))) notFound();
  await registrarAtividade({ usuarioId: u.id, clienteId: em.clienteId, acao: "SOS", descricao: `${u.nome} abriu a emergência de ${em.empregado.nome}` });
  const alerta = em.status === "ENCERRADA" ? [] : (await alertasDeEmergencia({ clienteId: em.clienteId })).filter((a) => a.chave === `sos:${em.id}`);
  const mapa = em.latitude != null && em.longitude != null ? `https://www.google.com/maps?q=${em.latitude},${em.longitude}` : null;
  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <Link href={u.papel === "CONSULTOR" ? "/consultor" : "/cliente"} className="text-sm font-semibold text-marca-700">← Voltar</Link>
      <h1 className="text-2xl font-bold text-red-700">🚨 Emergência — {em.empregado.nome}</h1>
      <Pendencias itens={alerta} titulo="Responda agora" />
      <section className="space-y-1 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
        <p><b>Acionado:</b> {fmt(em.iniciadaEm)}</p>
        <p><b>Situação:</b> {em.status === "ATIVA" ? "sem resposta" : em.status === "ATENDIDA" ? `${em.atendidaPor} está indo (${fmt(em.atendidaEm!)})` : `encerrada (${fmt(em.encerradaEm!)})`}</p>
        <p><b>Local:</b> {mapa ? <a href={mapa} target="_blank" rel="noreferrer" className="font-semibold text-marca-700 underline">abrir no mapa{em.precisao ? ` (precisão de ${Math.round(em.precisao)} m)` : ""}</a> : "o celular não enviou a localização"}</p>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-semibold">🎙️ Gravações ({em.trechos.length})</h2>
        {em.trechos.length ? (
          <ul className="space-y-2">
            {em.trechos.map((t) => (
              <li key={t.id} className="text-sm">
                <p className="text-slate-600">Trecho {t.ordem} — {fmt(t.criadoEm)}</p>
                <audio controls preload="none" src={`/api/emergencia/${em.id}/audio/${t.id}`} className="w-full" />
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-600">Nenhum trecho recebido ainda (o celular envia a cada 15 segundos; sem internet, não chega).</p>}
      </section>
      <p className="text-xs text-slate-500">Se for grave, ligue para 192 (SAMU), 193 (Bombeiros) ou 190 (Polícia). As gravações existem só por causa do SOS acionado por ela e ficam guardadas como registro da ocorrência (LGPD: proteção da vida e da integridade física). Cada acesso a esta página fica registrado.</p>
    </main>
  );
}
