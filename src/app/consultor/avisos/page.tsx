import { CentralAvisos } from "@/components/CentralAvisos";
import { Formulario } from "@/components/Formulario";
import { Cartao, Marcador, Selecao } from "@/components/ui";
import { exigirConsultor } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { chavePublicaPush } from "@/lib/notificacoes";
import { testarAvisos } from "./acoes";

export const metadata = { title: "Avisos" };

export default async function AvisosConsultor() {
  const u = await exigirConsultor();
  const clientes = await prisma.cliente.findMany({ where: { ativo: true, anonimizadoEm: null }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  return (
    <>
      <CentralAvisos usuarioId={u.id} />
      <div className="mt-6">
        <Cartao titulo="Testar os avisos nos celulares">
          <p className="mb-3 text-sm text-slate-600">
            Manda um exemplo de <b>cada tipo de aviso</b> (entrada não lançada, intervalo, saída, dia sem marcação, pedidos, fechar o mês, DAE, cobrança do Plus,
            guias…) para os celulares que já ativaram os avisos. Bloqueie a tela dos celulares antes de enviar para ver como chegam.
            {!(await chavePublicaPush()) && <b className="text-red-700"> As chaves de notificação (VAPID) ainda não estão no .env: os avisos ficam só dentro do app.</b>}
          </p>
          <Formulario acao={testarAvisos} textoBotao="Enviar avisos de teste agora">
            <Selecao rotulo="Cliente de teste (o patrão e a empregada dele recebem)" name="clienteId" opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
            <div className="grid gap-2 sm:grid-cols-3">
              <Marcador rotulo="Celular da empregada" name="EMPREGADO" defaultChecked />
              <Marcador rotulo="Celular do patrão" name="CLIENTE" defaultChecked />
              <Marcador rotulo="Meu celular (consultor)" name="CONSULTOR" defaultChecked />
            </div>
          </Formulario>
        </Cartao>
      </div>
    </>
  );
}
