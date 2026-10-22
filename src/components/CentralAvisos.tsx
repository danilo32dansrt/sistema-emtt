import Link from "next/link";
import { marcarAvisosLidos } from "@/app/acoes-avisos";
import { formatarData, partesLocais } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { chavePublicaPush } from "@/lib/notificacoes";
import { AtivarAvisos } from "./AtivarAvisos";
import { BotaoAcao } from "./Formulario";
import { Titulo, Vazio } from "./ui";

/** Central de avisos do patrão e da empregada (os mesmos que chegam no celular). */
export async function CentralAvisos({ usuarioId }: { usuarioId: string }) {
  const avisos = await prisma.notificacao.findMany({ where: { usuarioId }, orderBy: { criadaEm: "desc" }, take: 60 });
  const naoLidos = avisos.filter((a) => !a.lidaEm).length;
  return (
    <>
      <Titulo subtitulo="Lembretes do ponto, do DAE e dos pedidos de ajuste." acoes={naoLidos ? <BotaoAcao acao={marcarAvisosLidos}>Marcar todos como lidos</BotaoAcao> : undefined}>Avisos</Titulo>
      <div className="mb-4"><AtivarAvisos chavePublica={await chavePublicaPush()} /></div>
      {avisos.length ? (
        <ul className="space-y-2">
          {avisos.map((a) => {
            const quando = partesLocais(a.criadaEm);
            const corpo = (
              <>
                <p className="flex items-start justify-between gap-2 font-semibold">{a.titulo}{!a.lidaEm && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-marca-600" aria-label="não lido" />}</p>
                <p className="text-sm text-slate-700">{a.texto}</p>
                <p className="mt-1 text-xs text-slate-500">{formatarData(quando.data)} às {quando.hora}</p>
              </>
            );
            const classe = `block rounded-2xl border p-3 ${a.lidaEm ? "border-slate-200 bg-white" : "border-marca-200 bg-marca-50"}`;
            return <li key={a.id}>{a.link ? <Link href={a.link} className={classe}>{corpo}</Link> : <div className={classe}>{corpo}</div>}</li>;
          })}
        </ul>
      ) : (
        <Vazio>Nenhum aviso por enquanto.</Vazio>
      )}
    </>
  );
}
