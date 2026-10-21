import { Cartao, Titulo } from "@/components/ui";
import { exigirCliente } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

export const metadata = { title: "Dúvidas frequentes" };

export default async function Ajuda() {
  await exigirCliente();
  const artigos = await prisma.artigo.findMany({ where: { publico: true }, orderBy: [{ categoria: "asc" }, { titulo: "asc" }] });
  return (
    <>
      <Titulo subtitulo="Explicações simples sobre as obrigações do empregador doméstico.">Dúvidas frequentes</Titulo>
      <div className="space-y-3">
        {artigos.map((a) => (
          <Cartao key={a.id}>
            <details>
              <summary className="cursor-pointer text-lg font-semibold">{a.titulo} <span className="text-xs font-normal text-slate-500">· {a.categoria}</span></summary>
              <p className="mt-2 whitespace-pre-line text-slate-700">{a.conteudo}</p>
            </details>
          </Cartao>
        ))}
      </div>
    </>
  );
}
