import type { Metadata } from "next";
import { Aviso, Campo, Cartao } from "@/components/ui";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Verificar assinatura" };

const PAPEL = { CLIENTE: "Empregador(a)", EMPREGADO: "Empregado(a)", CONSULTOR: "Consultoria" } as const;

/** Página pública citada no carimbo ("Verifique em …/verificar"): confere um documento pelo código de verificação. */
export default async function VerificarPage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const codigo = ((await searchParams).codigo ?? "").trim();
  const doc = codigo && /^[a-z0-9]{10,40}$/i.test(codigo)
    ? await prisma.documento.findUnique({ where: { id: codigo }, select: { titulo: true, criadoEm: true, hash: true, assinaturas: { orderBy: { assinadoEm: "asc" }, select: { nome: true, papel: true, assinadoEm: true, hashDocumento: true } } } })
    : null;
  const data = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Verificar assinatura de documento</h1>
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1"><Campo rotulo="Código de verificação (impresso no carimbo)" name="codigo" defaultValue={codigo} required /></div>
        <button className="min-h-12 rounded-xl bg-marca-600 px-5 font-semibold text-white">Verificar</button>
      </form>
      {codigo && !doc && <Aviso tipo="critico">Nenhum documento encontrado com este código.</Aviso>}
      {doc && (
        <Cartao titulo={doc.titulo}>
          <p className="text-sm text-slate-600">Gerado em {data(doc.criadoEm)}.</p>
          <p className="mt-1 break-all text-xs text-slate-500">Hash SHA-256 do arquivo: {doc.hash}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {doc.assinaturas.map((a, i) => (
              <li key={i} className="rounded-xl bg-slate-50 p-3">
                <strong>{a.nome}</strong> ({PAPEL[a.papel]}) — assinou em {data(a.assinadoEm)}
                {a.hashDocumento === doc.hash ? <span className="ml-1 text-emerald-700">· confere com o arquivo</span> : <span className="ml-1 text-red-700">· hash diferente do arquivo atual</span>}
              </li>
            ))}
            {!doc.assinaturas.length && <li className="text-slate-500">Documento ainda sem assinaturas.</li>}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Para conferir o arquivo, compare o hash acima com o do PDF recebido (ou peça o PDF ao emissor).</p>
        </Cartao>
      )}
    </main>
  );
}
