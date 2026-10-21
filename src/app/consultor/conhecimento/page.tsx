import { BotaoAcao, Formulario } from "@/components/Formulario";
import { AreaTexto, Campo, Cartao, Marcador, Selo, Titulo } from "@/components/ui";
import { prisma } from "@/lib/db";
import { linkWhatsapp } from "@/lib/whatsapp";
import { excluirArtigo, salvarArtigo, salvarResposta } from "./acoes";

export const metadata = { title: "Base de conhecimento" };

export default async function Conhecimento() {
  const [artigos, respostas] = await Promise.all([prisma.artigo.findMany({ orderBy: [{ categoria: "asc" }, { titulo: "asc" }] }), prisma.respostaPronta.findMany({ orderBy: { titulo: "asc" } })]);
  return (
    <>
      <Titulo subtitulo="Perguntas frequentes e explicações simples para enviar aos clientes. Os artigos públicos aparecem no portal do cliente.">Base de conhecimento</Titulo>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {artigos.map((a) => (
            <Cartao key={a.id}>
              <details>
                <summary className="cursor-pointer font-semibold">{a.titulo} <Selo>{a.categoria}</Selo> {!a.publico && <Selo cor="amarelo">interno</Selo>}</summary>
                <p className="mt-2 whitespace-pre-line text-sm">{a.conteudo}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a className="inline-flex min-h-9 items-center rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white" target="_blank" rel="noreferrer" href={linkWhatsapp("", `*${a.titulo}*\n\n${a.conteudo}`)}>Enviar por WhatsApp</a>
                  <BotaoAcao acao={excluirArtigo} campos={{ id: a.id }} confirmar="Excluir este artigo?">Excluir</BotaoAcao>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-marca-700">Editar</summary>
                  <Formulario acao={salvarArtigo} className="mt-2">
                    <input type="hidden" name="id" value={a.id} />
                    <Campo rotulo="Título" name="titulo" defaultValue={a.titulo} />
                    <Campo rotulo="Categoria" name="categoria" defaultValue={a.categoria} />
                    <AreaTexto rotulo="Conteúdo" name="conteudo" rows={6} defaultValue={a.conteudo} />
                    <Marcador rotulo="Visível no portal do cliente" name="publico" defaultChecked={a.publico} />
                  </Formulario>
                </details>
              </details>
            </Cartao>
          ))}
        </div>
        <div className="space-y-4">
          <Cartao titulo="Novo artigo">
            <Formulario acao={salvarArtigo} limparAoSalvar>
              <Campo rotulo="Título" name="titulo" required />
              <Campo rotulo="Categoria" name="categoria" required />
              <AreaTexto rotulo="Conteúdo" name="conteudo" rows={6} required />
              <Marcador rotulo="Visível no portal do cliente" name="publico" defaultChecked />
            </Formulario>
          </Cartao>
          <Cartao titulo="Respostas prontas (chat)">
            <ul className="mb-3 space-y-1 text-sm">{respostas.map((r) => <li key={r.id}><strong>{r.titulo}:</strong> {r.texto}</li>)}</ul>
            <Formulario acao={salvarResposta} limparAoSalvar variante="secundario">
              <Campo rotulo="Título" name="titulo" required />
              <AreaTexto rotulo="Texto" name="texto" required />
            </Formulario>
          </Cartao>
        </div>
      </div>
    </>
  );
}
