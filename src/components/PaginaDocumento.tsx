import { notFound } from "next/navigation";
import { assinarDocumento } from "@/app/acoes-documentos";
import { posicoesDosCarimbos, type PosicaoCarimbo } from "@/lib/assinatura/carimbo";
import { baseVerificacao } from "@/lib/assinatura/endereco";
import type { UsuarioLogado } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { infoPdf } from "@/lib/pdf/carimbo";
import { podeVerDocumento } from "@/lib/servicos/acesso-documentos";
import { PosicionarCarimbos, type CarimboTela } from "./assinatura/PosicionarCarimbos";
import { Formulario } from "./Formulario";
import { Aviso, Cartao, Marcador, Selo, Titulo } from "./ui";

/** Visualização do documento com assinatura eletrônica (cliente, empregado ou consultor). */
export async function PaginaDocumento({ usuario, id }: { usuario: UsuarioLogado; id: string }) {
  const doc = await podeVerDocumento(usuario, id);
  if (!doc) notFound();
  const [assinaturas, salvas, arquivo] = await Promise.all([
    prisma.assinatura.findMany({ where: { documentoId: id }, orderBy: { assinadoEm: "asc" } }),
    prisma.posicaoCarimbo.findMany({ where: { documentoId: id } }),
    prisma.arquivo.findUniqueOrThrow({ where: { id: doc.arquivoId }, select: { mime: true, dados: true } }),
  ]);
  const jaAssinou = assinaturas.some((a) => a.usuarioId === usuario.id);
  const podeAssinar = !jaAssinou && ((usuario.papel === "EMPREGADO" && doc.exigeAssinaturaEmpregado) || (usuario.papel === "CLIENTE" && doc.exigeAssinaturaCliente));

  // Carimbos: os já assinados e, para quem ainda vai assinar, a prévia do lugar (pode escolher antes de assinar).
  let paginas: { largura: number; altura: number }[] = [];
  let carimbos: CarimboTela[] = [];
  if (arquivo.mime === "application/pdf") {
    const info = await infoPdf(new Uint8Array(arquivo.dados));
    paginas = info.paginas;
    const lista = [
      ...assinaturas.map((a) => ({ usuarioId: a.usuarioId, papel: a.papel, nome: a.nome, data: a.assinadoEm.toISOString() as string | null })),
      ...(podeAssinar ? [{ usuarioId: usuario.id, papel: usuario.papel, nome: usuario.nome, data: null }] : []),
    ];
    const pos = posicoesDosCarimbos(lista, Object.fromEntries(salvas.map((s) => [s.usuarioId, { pagina: s.pagina, x: s.x, y: s.y }])), info.locais, paginas);
    const ultima = Math.max(paginas.length - 1, 0);
    const sugestao = (i: number): PosicaoCarimbo => ({ pagina: ultima, x: 0.08 + (i % 2) * 0.42, y: 0.7 + Math.floor(i / 2) * 0.07 });
    carimbos = lista.map((c, i) => ({
      usuarioId: c.usuarioId,
      nome: c.nome,
      data: c.data,
      pos: pos[c.usuarioId] ?? sugestao(i),
      temLugar: Boolean(pos[c.usuarioId]),
      podeMover: c.usuarioId === usuario.id || usuario.papel === "CONSULTOR",
    }));
  }

  return (
    <>
      <Titulo subtitulo={`Gerado em ${doc.criadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}>{doc.titulo}</Titulo>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {paginas.length ? (
            <PosicionarCarimbos documentoId={id} urlPdf={`/api/documentos/${id}?original=1`} paginas={paginas} carimbos={carimbos} codigo={doc.codigoVerificacao} endereco={baseVerificacao()} />
          ) : (
            <object data={`/api/documentos/${id}`} type="application/pdf" className="h-[70vh] w-full rounded-2xl border border-slate-200 bg-white">
              <a className="text-marca-700 underline" href={`/api/documentos/${id}`}>Abrir o PDF</a>
            </object>
          )}
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
                <p className="text-xs text-slate-500">Serão registrados seu nome, data, hora, endereço IP e o código (hash) do documento. Antes de assinar, você pode arrastar o carimbo para o lugar da sua assinatura.</p>
              </Formulario>
            </Cartao>
          )}
          {jaAssinou && <Aviso tipo="sucesso">Você já assinou este documento.</Aviso>}
        </div>
      </div>
    </>
  );
}
