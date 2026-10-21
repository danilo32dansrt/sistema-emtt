import { Formulario } from "@/components/Formulario";
import { AreaTexto, Campo, Cartao, Grade, Selecao, Titulo } from "@/components/ui";
import { formatarData, formatarMoeda, formatarTelefone } from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { linkWhatsapp } from "@/lib/whatsapp";
import { gerarProposta, salvarLead } from "./acoes";

export const metadata = { title: "Captação de clientes" };

const ETAPAS = [
  { valor: "NOVO", rotulo: "Novo" },
  { valor: "CONTATO", rotulo: "Em contato" },
  { valor: "PROPOSTA", rotulo: "Proposta enviada" },
  { valor: "NEGOCIACAO", rotulo: "Negociação" },
  { valor: "GANHO", rotulo: "Fechado" },
  { valor: "PERDIDO", rotulo: "Perdido" },
];

export default async function Captacao() {
  const leads = await prisma.lead.findMany({ orderBy: { atualizadoEm: "desc" } });
  return (
    <>
      <Titulo subtitulo="Cadastre interessados, gere a proposta pela tabela de preços e acompanhe a negociação.">Captação de clientes</Titulo>
      <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
        {ETAPAS.map((etapa) => {
          const lista = leads.filter((l) => l.status === etapa.valor);
          return (
            <div key={etapa.valor} className="w-72 shrink-0 rounded-2xl bg-slate-100 p-3">
              <p className="mb-2 font-semibold">{etapa.rotulo} <span className="text-slate-500">({lista.length})</span></p>
              <div className="space-y-2">
                {lista.map((l) => {
                  const proposta = l.observacoes?.match(/\/api\/arquivos\/\w+/)?.[0];
                  return (
                    <details key={l.id} className="rounded-xl bg-white p-3 shadow-sm">
                      <summary className="cursor-pointer">
                        <span className="font-semibold">{l.nome}</span>
                        <span className="block text-xs text-slate-500">{l.qtdEmpregados} empregado(s){l.valorProposta ? ` · ${formatarMoeda(num(l.valorProposta))}/mês` : ""}{l.proximoContato ? ` · retorno ${formatarData(l.proximoContato)}` : ""}</span>
                      </summary>
                      <div className="mt-2 space-y-2 text-sm">
                        {l.telefone && <a className="inline-flex min-h-9 items-center rounded-xl bg-[#25D366] px-3 font-semibold text-white" target="_blank" rel="noreferrer" href={linkWhatsapp(l.telefone, `Olá, ${l.nome.split(" ")[0]}! Tudo bem?`)}>WhatsApp {formatarTelefone(l.telefone)}</a>}
                        {proposta && <a className="ml-2 font-semibold text-marca-700 underline" target="_blank" href={proposta}>Ver proposta</a>}
                        <Formulario acao={gerarProposta} textoBotao="Gerar proposta em PDF" variante="secundario" pequeno><input type="hidden" name="id" value={l.id} /></Formulario>
                        <Formulario acao={salvarLead} textoBotao="Salvar" pequeno>
                          <input type="hidden" name="id" value={l.id} />
                          <input type="hidden" name="nome" value={l.nome} />
                          <input type="hidden" name="qtdEmpregados" value={l.qtdEmpregados} />
                          <input type="hidden" name="telefone" value={l.telefone ?? ""} />
                          <input type="hidden" name="email" value={l.email ?? ""} />
                          <input type="hidden" name="cidade" value={l.cidade ?? ""} />
                          <input type="hidden" name="origem" value={l.origem ?? ""} />
                          <Selecao rotulo="Etapa" name="status" defaultValue={l.status} opcoes={ETAPAS} />
                          <Campo rotulo="Próximo contato" name="proximoContato" type="date" defaultValue={l.proximoContato?.toISOString().slice(0, 10)} />
                          <AreaTexto rotulo="Anotações" name="observacoes" defaultValue={l.observacoes ?? ""} />
                        </Formulario>
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <Cartao titulo="Novo interessado" className="max-w-2xl">
        <Formulario acao={salvarLead} limparAoSalvar>
          <Grade>
            <Campo rotulo="Nome" name="nome" required />
            <Campo rotulo="Telefone / WhatsApp" name="telefone" />
            <Campo rotulo="E-mail" name="email" type="email" />
            <Campo rotulo="Cidade" name="cidade" />
            <Campo rotulo="Quantos empregados" name="qtdEmpregados" type="number" min={1} defaultValue={1} />
            <Campo rotulo="Como conheceu" name="origem" placeholder="Indicação, Instagram..." />
          </Grade>
          <AreaTexto rotulo="Anotações" name="observacoes" />
        </Formulario>
      </Cartao>
    </>
  );
}
