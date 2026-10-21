import { ListaDocumentos } from "@/components/ListaDocumentos";
import { Cartao } from "@/components/ui";
import { exigirEmpregado } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

export default async function MeusDocumentos() {
  const u = await exigirEmpregado();
  const docs = await prisma.documento.findMany({ where: { empregadoId: u.empregadoId, visivelEmpregado: true }, include: { assinaturas: true }, orderBy: { criadoEm: "desc" } });
  return <Cartao titulo="Meus documentos"><ListaDocumentos documentos={docs} linkDetalhe={(id) => `/ponto/documentos/${id}`} /></Cartao>;
}
