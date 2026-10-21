import { BotaoAcao, Formulario } from "@/components/Formulario";
import { Campo, Cartao, Celula, Grade, Indicador, Selecao, Selo, Tabela, Titulo } from "@/components/ui";
import { formatarCompetencia, formatarData, formatarMoeda, hojeBrasil, nomeMes, somar } from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { configuracao, modelosMensagem } from "@/lib/tabelas-db";
import { linkWhatsapp, preencherModelo } from "@/lib/whatsapp";
import { configInter } from "@/lib/inter/api";
import { cobrancaAtiva, ROTULOS_SITUACAO_INTER } from "@/lib/inter/regras";
import { atualizarCobrancaInter, baixarMensalidade, baixarServico, cancelarCobrancaInter, emitirCobrancaInter, gerarMensalidades, reabrirMensalidade, salvarServico, simularPagamentoInter } from "./acoes";

export const metadata = { title: "Financeiro" };

export default async function Financeiro({ searchParams }: { searchParams: Promise<{ ano?: string; mes?: string; cliente?: string }> }) {
  const sp = await searchParams;
  const hoje = hojeBrasil();
  const ano = Number(sp.ano) || hoje.getUTCFullYear();
  const mes = Number(sp.mes) || hoje.getUTCMonth() + 1;
  const [mensalidades, atrasadas, servicos, clientes, cfg, modelos] = await Promise.all([
    prisma.mensalidade.findMany({ where: { ano, mes, ...(sp.cliente ? { clienteId: sp.cliente } : {}) }, include: { cliente: { select: { nome: true, telefone: true } } }, orderBy: { cliente: { nome: "asc" } } }),
    prisma.mensalidade.findMany({ where: { status: "ABERTO", vencimento: { lt: hoje } }, include: { cliente: { select: { nome: true, telefone: true } } }, orderBy: { vencimento: "asc" } }),
    prisma.servicoAvulso.findMany({ where: { data: { gte: new Date(Date.UTC(ano, mes - 1, 1)), lt: new Date(Date.UTC(ano, mes, 1)) } }, include: { cliente: { select: { nome: true } } }, orderBy: { data: "desc" } }),
    prisma.cliente.findMany({ where: { anonimizadoEm: null }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    configuracao(),
    modelosMensagem(),
  ]);
  const modelo = modelos.find((m) => m.chave === "cobrar_mensalidade")!;
  const previsto = somar(...mensalidades.map((m) => num(m.valor)), ...servicos.map((s) => num(s.valor)));
  const recebido = somar(...mensalidades.filter((m) => m.status === "PAGO").map((m) => num(m.valor)), ...servicos.filter((s) => s.status === "PAGO").map((s) => num(s.valor)));
  const inadimplencia = somar(...atrasadas.map((m) => num(m.valor)));
  const mesAtualIso = `${ano}-${String(mes).padStart(2, "0")}`;
  const inter = configInter();
  const usaInter = cfg.cobrancaInter && inter.configurado;
  const corSituacao = (s: string | null) => (s === "RECEBIDO" || s === "MARCADO_RECEBIDO" ? "verde" : s === "ATRASADO" || s === "FALHA_EMISSAO" ? "vermelho" : s === "A_RECEBER" || s === "EM_PROCESSAMENTO" ? "azul" : "cinza");

  return (
    <>
      <Titulo subtitulo={`Relatório de ${nomeMes(mes)}/${ano}`} acoes={<a className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-4 font-semibold" href={`/api/exportar/financeiro?ano=${ano}&mes=${mes}`}>Exportar planilha</a>}>Financeiro</Titulo>
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <Campo rotulo="Mês" name="mes" type="number" min={1} max={12} defaultValue={mes} />
        <Campo rotulo="Ano" name="ano" type="number" defaultValue={ano} />
        <button className="min-h-12 rounded-xl bg-slate-800 px-5 font-semibold text-white">Ver</button>
      </form>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Faturamento previsto" valor={formatarMoeda(previsto)} />
        <Indicador rotulo="Recebido" valor={formatarMoeda(recebido)} cor="verde" />
        <Indicador rotulo="A receber no mês" valor={formatarMoeda(somar(previsto, -recebido))} cor="amarelo" />
        <Indicador rotulo="Inadimplência total" valor={formatarMoeda(inadimplencia)} cor={inadimplencia ? "vermelho" : "verde"} detalhe={`${atrasadas.length} mensalidade(s) vencida(s)`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Cartao titulo={`Mensalidades ${formatarCompetencia(ano, mes)}`} acoes={<Formulario acao={gerarMensalidades} textoBotao="Gerar mensalidades do mês" variante="secundario" pequeno><input type="hidden" name="competencia" value={mesAtualIso} /></Formulario>}>
            {usaInter ? <p className="mb-3 text-sm text-slate-600">Cobrança automática pelo Banco Inter ligada{inter.ambiente === "sandbox" ? " (ambiente de TESTES — nenhum dinheiro de verdade)" : ""}: a baixa é feita sozinha quando o cliente paga.</p> : <p className="mb-3 text-sm text-slate-600">Cobrança automática pelo Inter desligada. <a className="font-semibold text-marca-700 underline" href="/consultor/configuracoes#inter">Configurar</a></p>}
            <Tabela cabecalho={["Cliente", "Valor", "Vencimento", "Situação", ...(usaInter ? ["Banco Inter"] : []), ""]} vazio="Nenhuma mensalidade gerada para este mês.">
              {mensalidades.map((m) => {
                const msg = preencherModelo(modelo.texto, { nome: m.cliente.nome.split(" ")[0], "mês": `${nomeMes(m.mes)}/${m.ano}`, mes: `${nomeMes(m.mes)}/${m.ano}`, valor: formatarMoeda(num(m.valor)), data: formatarData(m.vencimento), pix: cfg.chavePix ?? "" });
                return (
                  <tr key={m.id}>
                    <Celula>{m.cliente.nome}</Celula>
                    <Celula className="tabular-nums">{formatarMoeda(num(m.valor))}</Celula>
                    <Celula>{formatarData(m.vencimento)}</Celula>
                    <Celula>{m.status === "PAGO" ? <Selo cor="verde">pago {m.pagoEm ? formatarData(m.pagoEm) : ""}</Selo> : m.vencimento < hoje ? <Selo cor="vermelho">atrasado</Selo> : <Selo cor="amarelo">aberto</Selo>}{m.formaPagamento && m.status === "PAGO" && <span className="block text-xs text-slate-500">{m.formaPagamento}</span>}</Celula>
                    {usaInter && (
                      <Celula>
                        {m.interCodigo && <Selo cor={corSituacao(m.interSituacao)}>{ROTULOS_SITUACAO_INTER[m.interSituacao ?? ""] ?? "—"}</Selo>}
                        {m.interErro && <span className="block max-w-56 text-xs text-red-700">{m.interErro}</span>}
                        {m.status === "ABERTO" && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {!cobrancaAtiva(m.interSituacao) && <BotaoAcao acao={emitirCobrancaInter} campos={{ id: m.id }}>{m.interCodigo ? "Emitir de novo" : "Emitir cobrança"}</BotaoAcao>}
                            {m.interCodigo && <BotaoAcao acao={atualizarCobrancaInter} campos={{ id: m.id }}>Atualizar</BotaoAcao>}
                            {cobrancaAtiva(m.interSituacao) && <a className="inline-flex min-h-9 items-center rounded-xl border border-slate-300 px-3 text-sm font-semibold" href={`/api/inter/boleto/${m.id}`} target="_blank" rel="noreferrer">Boleto</a>}
                            {cobrancaAtiva(m.interSituacao) && <BotaoAcao acao={cancelarCobrancaInter} campos={{ id: m.id }} confirmar="Cancelar esta cobrança no banco? O cliente não conseguirá mais pagá-la.">Cancelar</BotaoAcao>}
                            {inter.ambiente === "sandbox" && cobrancaAtiva(m.interSituacao) && <BotaoAcao acao={simularPagamentoInter} campos={{ id: m.id, forma: "PIX" }} variante="sucesso">Simular Pix (teste)</BotaoAcao>}
                          </span>
                        )}
                      </Celula>
                    )}
                    <Celula className="whitespace-nowrap">
                      {m.status === "PAGO" ? <BotaoAcao acao={reabrirMensalidade} campos={{ id: m.id }}>Reabrir</BotaoAcao> : (
                        <span className="flex gap-1">
                          <BotaoAcao acao={baixarMensalidade} campos={{ id: m.id, forma: usaInter ? "Outro meio" : "Pix" }} variante="sucesso" confirmar={usaInter && cobrancaAtiva(m.interSituacao) ? "Dar baixa manual? A cobrança no Inter será cancelada." : undefined}>Pago</BotaoAcao>
                          {m.cliente.telefone && <a className="inline-flex min-h-9 items-center rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white" target="_blank" rel="noreferrer" href={linkWhatsapp(m.cliente.telefone, msg)}>Cobrar</a>}
                        </span>
                      )}
                    </Celula>
                  </tr>
                );
              })}
            </Tabela>
          </Cartao>
          <Cartao titulo="Serviços avulsos do mês">
            <Tabela cabecalho={["Data", "Cliente", "Serviço", "Valor", ""]} vazio="Nenhum serviço avulso.">
              {servicos.map((s) => (
                <tr key={s.id}>
                  <Celula>{formatarData(s.data)}</Celula>
                  <Celula>{s.cliente.nome}</Celula>
                  <Celula>{s.descricao} <span className="text-xs text-slate-500">({s.tipo.toLowerCase()})</span></Celula>
                  <Celula className="tabular-nums">{formatarMoeda(num(s.valor))}</Celula>
                  <Celula>{s.status === "PAGO" ? <Selo cor="verde">pago</Selo> : <BotaoAcao acao={baixarServico} campos={{ id: s.id }} variante="sucesso">Pago</BotaoAcao>}</Celula>
                </tr>
              ))}
            </Tabela>
          </Cartao>
        </div>
        <div className="space-y-4">
          <Cartao titulo="Inadimplentes">
            <ul className="space-y-1 text-sm">
              {atrasadas.map((m) => <li key={m.id} className="flex justify-between gap-2"><span>{m.cliente.nome} ({formatarCompetencia(m.ano, m.mes)})</span><span className="font-semibold text-red-700">{formatarMoeda(num(m.valor))}</span></li>)}
              {!atrasadas.length && <li className="text-emerald-700">Ninguém em atraso.</li>}
            </ul>
          </Cartao>
          <Cartao titulo="Lançar serviço avulso">
            <Formulario acao={salvarServico} limparAoSalvar>
              <Selecao rotulo="Cliente" name="clienteId" opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
              <Selecao rotulo="Tipo" name="tipo" opcoes={[{ valor: "REGULARIZACAO", rotulo: "Regularização" }, { valor: "RESCISAO", rotulo: "Rescisão" }, { valor: "ADMISSAO", rotulo: "Admissão" }, { valor: "OUTRO", rotulo: "Outro" }]} />
              <Campo rotulo="Descrição" name="descricao" required />
              <Grade>
                <Campo rotulo="Valor (R$)" name="valor" inputMode="decimal" required />
                <Campo rotulo="Data" name="data" type="date" required />
              </Grade>
            </Formulario>
          </Cartao>
          {!cfg.chavePix && <p className="text-sm text-amber-700">Cadastre a chave Pix em Configurações para o cliente pagar pelo portal.</p>}
        </div>
      </div>
    </>
  );
}
