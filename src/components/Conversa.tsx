import { enviarMensagem } from "@/app/acoes-mensagens";
import { prisma } from "@/lib/db";
import { Formulario } from "./Formulario";
import { AreaTexto, Vazio } from "./ui";

/** Chat interno entre cliente e consultor, com histórico. */
export async function Conversa({ clienteId, usuarioId, respostas }: { clienteId: string; usuarioId: string; respostas?: { titulo: string; texto: string }[] }) {
  const mensagens = await prisma.mensagem.findMany({ where: { clienteId }, include: { autor: { select: { nome: true, papel: true } } }, orderBy: { criadoEm: "asc" }, take: 300 });
  return (
    <div className="space-y-4">
      <div className="max-h-[55vh] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3">
        {!mensagens.length && <Vazio>Nenhuma mensagem ainda. Escreva abaixo!</Vazio>}
        {mensagens.map((m) => {
          const minha = m.autorId === usuarioId;
          return (
            <div key={m.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${minha ? "bg-marca-600 text-white" : "bg-slate-100 text-slate-900"}`}>
                <p className="whitespace-pre-line">{m.texto}</p>
                <p className={`mt-1 text-[11px] ${minha ? "text-marca-100" : "text-slate-500"}`}>{m.autor.nome} · {m.criadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          );
        })}
      </div>
      {respostas && respostas.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-marca-700">Respostas prontas</summary>
          <ul className="mt-2 space-y-2">{respostas.map((r) => <li key={r.titulo}><strong>{r.titulo}:</strong> <span className="select-all">{r.texto}</span></li>)}</ul>
        </details>
      )}
      <Formulario acao={enviarMensagem} textoBotao="Enviar" limparAoSalvar>
        <input type="hidden" name="clienteId" value={clienteId} />
        <AreaTexto rotulo="Mensagem" name="texto" required />
      </Formulario>
    </div>
  );
}
