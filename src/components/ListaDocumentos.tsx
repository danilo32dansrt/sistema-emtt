import Link from "next/link";
import type { Assinatura, Documento } from "@prisma/client";
import { Celula, Selo, Tabela } from "./ui";

type Doc = Documento & { assinaturas: Assinatura[]; empregado?: { nome: string } | null; cliente?: { nome: string } };

export function situacaoAssinaturas(d: Doc) {
  const empregado = d.assinaturas.some((a) => a.papel === "EMPREGADO");
  const cliente = d.assinaturas.some((a) => a.papel === "CLIENTE");
  const faltam = [d.exigeAssinaturaCliente && !cliente && "empregador", d.exigeAssinaturaEmpregado && !empregado && "empregado"].filter(Boolean) as string[];
  return { faltam, completo: faltam.length === 0 };
}

export function ListaDocumentos({ documentos, linkDetalhe, mostrarCliente, acoes }: { documentos: Doc[]; linkDetalhe: (id: string) => string; mostrarCliente?: boolean; acoes?: (d: Doc) => React.ReactNode }) {
  return (
    <Tabela cabecalho={["Documento", mostrarCliente ? "Cliente / empregado" : "Empregado", "Data", "Assinaturas", ""]} vazio="Nenhum documento.">
      {documentos.map((d) => {
        const s = situacaoAssinaturas(d);
        return (
          <tr key={d.id}>
            <Celula><Link className="font-semibold text-marca-700 hover:underline" href={linkDetalhe(d.id)}>{d.titulo}</Link></Celula>
            <Celula>{mostrarCliente && d.cliente ? `${d.cliente.nome}${d.empregado ? ` / ${d.empregado.nome}` : ""}` : d.empregado?.nome ?? "—"}</Celula>
            <Celula className="whitespace-nowrap">{d.criadoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</Celula>
            <Celula>{!d.exigeAssinaturaCliente && !d.exigeAssinaturaEmpregado ? <Selo>não precisa</Selo> : s.completo ? <Selo cor="verde">assinado</Selo> : <Selo cor="amarelo">falta {s.faltam.join(" e ")}</Selo>}</Celula>
            <Celula className="whitespace-nowrap"><a className="text-sm font-semibold text-marca-700" target="_blank" href={`/api/documentos/${d.id}`}>PDF</a> {acoes?.(d)}</Celula>
          </tr>
        );
      })}
    </Tabela>
  );
}
