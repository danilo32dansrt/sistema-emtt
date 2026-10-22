import type { Metadata } from "next";
import { Aviso, Campo, Cartao } from "@/components/ui";
import { FORMATO_CODIGO } from "@/lib/assinatura/carimbo";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Verificar assinatura" };

const PAPEL = { CLIENTE: "Empregador(a)", EMPREGADO: "Empregado(a)", CONSULTOR: "Consultoria" } as const;

/** Página pública citada no carimbo ("Verifique em …/verificar"): confere um documento pelo código de verificação. */
export default async function VerificarPage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const codigo = ((await searchParams).codigo ?? "").trim();
  const curto = codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const doc = FORMATO_CODIGO.test(curto) || /^[a-z0-9]{20,40}$/.test(codigo)
    ? await prisma.documento.findFirst({ where: FORMATO_CODIGO.test(curto) ? { codigoVerificacao: curto } : { id: codigo }, select: { titulo: true, criadoEm: true, hash: true, codigoVerificacao: true, assinaturas: { orderBy: { assinadoEm: "asc" }, select: { nome: true, papel: true, assinadoEm: true, hashDocumento: true } } } })
    : null;
  const data = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Verificador de documentos e assinaturas</h1>
      <p className="text-sm text-slate-600">Digite o código impresso no carimbo de assinatura (4 letras e 6 números) ou abra pelo QR Code. Não é preciso login.</p>
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1"><Campo rotulo="Código de verificação (ex.: DJSD586588, no fim do endereço do carimbo)" name="codigo" defaultValue={codigo} required /></div>
        <button className="min-h-12 rounded-xl bg-marca-600 px-5 font-semibold text-white">Verificar</button>
      </form>
      {codigo && !doc && <Aviso tipo="critico">Nenhum documento encontrado com este código.</Aviso>}
      {doc && (() => {
        const validas = doc.assinaturas.filter((a) => a.hashDocumento === doc.hash).length;
        const total = doc.assinaturas.length;
        return (
          <>
            <Aviso tipo={total && validas === total ? "sucesso" : total ? "critico" : "aviso"} titulo={total && validas === total ? "Documento autêntico e assinado" : total ? "Atenção: assinatura de outra versão do arquivo" : "Documento autêntico, ainda sem assinaturas"}>
              Consulta: código {doc.codigoVerificacao}
            </Aviso>
            <Cartao titulo="1 · Documento">
              <p className="text-sm">Autêntico: emitido por este sistema e registrado com a impressão digital (hash SHA-256) abaixo. Para conferir um PDF recebido, compare o hash dele com este.</p>
              <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="font-semibold text-slate-600">Documento</dt><dd>{doc.titulo}</dd>
                <dt className="font-semibold text-slate-600">Gerado em</dt><dd>{data(doc.criadoEm)}</dd>
                <dt className="font-semibold text-slate-600">Código</dt><dd>{doc.codigoVerificacao}</dd>
                <dt className="font-semibold text-slate-600">Hash SHA-256</dt><dd className="break-all text-xs">{doc.hash}</dd>
              </dl>
            </Cartao>
            <Cartao titulo={`2 · Assinaturas${total ? ` — válidas nesta versão: ${validas} de ${total}` : ""}`}>
              <ul className="space-y-2 text-sm">
                {doc.assinaturas.map((a, i) => (
                  <li key={i} className="rounded-xl bg-slate-50 p-3">
                    <strong className="uppercase">{a.nome}</strong> ({PAPEL[a.papel]})<br />
                    Assinou em {data(a.assinadoEm)} · login e senha no sistema (Lei 14.063/2020, art. 4º, I)<br />
                    {a.hashDocumento === doc.hash ? <span className="font-semibold text-emerald-700">Válida nesta versão</span> : <span className="font-semibold text-red-700">Assinou outra versão do arquivo</span>}
                  </li>
                ))}
                {!total && <li className="text-slate-500">Documento ainda sem assinaturas.</li>}
              </ul>
            </Cartao>
          </>
        );
      })()}
    </main>
  );
}
