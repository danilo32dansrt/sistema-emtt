import { notFound } from "next/navigation";
import { assinarDocumento } from "@/app/acoes-documentos";
import type { UsuarioLogado } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { podeVerDocumento } from "@/lib/servicos/acesso-documentos";
import { Formulario } from "./Formulario";
import { Aviso, Cartao, Marcador, Selo, Titulo } from "./ui";

/** Visualização do documento com assinatura eletrônica (cliente, empregado ou consultor). */
export async function PaginaDocumento({ usuario, id }: { usuario: UsuarioLogado; id: string }) {
  const doc = await podeVerDocumento(usuario, id);
  if (!doc) notFound();
  const assinaturas = await prisma.assinatura.findMany({ where: { documentoId: id }, orderBy: { assinadoEm: "asc" } });
  const jaAssinou = assinaturas.some((a) => a.usuarioId === usuario.id);
  const podeAssinar = !jaAssinou && ((usuario.papel === "EMPREGADO" && doc.exigeAssinaturaEmpregado) || (usuario.papel === "CLIENTE" && doc.exigeAssinaturaCliente));
  return (
    <>
      <Titulo subtitulo={`Gerado em ${doc.criadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}>{doc.titulo}</Titulo>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <object data={`/api/documentos/${id}`} type="application/pdf" className="h-[70vh] w-full rounded-2xl border border-slate-200 bg-white">
            <a className="text-marca-700 underline" href={`/api/documentos/${id}`}>Abrir o PDF</a>
          </object>
        </div>
        <div className="space-y-4">
          <a href={`/api/documentos/${id}`} target="_blank" className="flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white font-semibold">Baixar / abrir PDF</a>
          <Cartao titulo="Assinaturas">
            <ul className="space-y-2 text-sm">
              {assinaturas.map((a) => (
                <li key={a.id}><Selo cor="verde">assinado</Selo> {a.nome} — {a.assinadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</li>
              ))}
              {!assinaturas.length && <li className="text-slate-500">Ainda sem assinaturas.</li>}
            </ul>
          </Cartao>
          {podeAssinar && (
            <Cartao titulo="Assinar eletronicamente">
              <Formulario acao={assinarDocumento} textoBotao="Assinar documento" variante="sucesso">
                <input type="hidden" name="documentoId" value={id} />
                <Marcador name="concordo" rotulo="Li o documento e concordo com o seu conteúdo." required />
                <p className="text-xs text-slate-500">Serão registrados seu nome, data, hora, endereço IP e o código (hash) do documento.</p>
              </Formulario>
            </Cartao>
          )}
          {jaAssinou && <Aviso tipo="sucesso">Você já assinou este documento.</Aviso>}
        </div>
      </div>
    </>
  );
}
