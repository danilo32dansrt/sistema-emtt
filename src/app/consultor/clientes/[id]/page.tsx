import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoAcao, Formulario } from "@/components/Formulario";
import { Aviso, Campo, Cartao, Celula, Grade, LinkBotao, Selo, Tabela, Titulo } from "@/components/ui";
import {
  formatarCompetencia, formatarCpf, formatarData, formatarMoeda, formatarTelefone, hojeBrasil, nomeMes, NOMES_REGIME, situacaoChecklist,
} from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { competenciaPadrao } from "@/lib/servicos/competencia";
import { diagnosticoDoCliente } from "@/lib/servicos/diagnostico";
import { configuracao, modelosMensagem } from "@/lib/tabelas-db";
import { linkWhatsapp, preencherModelo } from "@/lib/whatsapp";
import { criarAcessoCliente, desativarAcesso, registrarTempo } from "../acoes";

export default async function DetalheCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hoje = hojeBrasil();
  const comp = competenciaPadrao(hoje);
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      empregados: { orderBy: [{ situacao: "asc" }, { nome: "asc" }], include: { competencias: { where: { ano: comp.ano, mes: comp.mes } } } },
      usuarios: { where: { papel: "CLIENTE" } },
      mensalidades: { orderBy: [{ ano: "desc" }, { mes: "desc" }], take: 6 },
      registrosTempo: { orderBy: { data: "desc" }, take: 10 },
      atividades: { orderBy: { criadoEm: "desc" }, take: 15, include: { usuario: { select: { nome: true } } } },
    },
  });
  if (!cliente || cliente.anonimizadoEm) notFound();
  const [diag, modelos, cfg] = await Promise.all([diagnosticoDoCliente(id, hoje), modelosMensagem(), configuracao()]);
  const acesso = cliente.usuarios[0];
  const ativos = cliente.empregados.filter((e) => e.situacao !== "DESLIGADO");
  const tempoTotal = cliente.registrosTempo.reduce((t, r) => t + r.minutos, 0);
  const ultimaComp = cliente.empregados.flatMap((e) => e.competencias).find((c) => c.daeValor);
  const valoresMsg = {
    nome: cliente.nome.split(" ")[0],
    "mês": `${nomeMes(comp.mes)}/${comp.ano}`,
    mes: `${nomeMes(comp.mes)}/${comp.ano}`,
    valor: ultimaComp?.daeValor ? formatarMoeda(num(ultimaComp.daeValor)) : formatarMoeda(num(cliente.mensalidade)),
    data: formatarData(situacaoChecklist(comp.ano, comp.mes, {}, hoje).vencimentoDae),
    empregado: ativos.map((e) => e.nome.split(" ")[0]).join(", ") || "sua empregada",
    pix: cfg.chavePix ?? "(chave Pix)",
  };

  return (
    <>
      <Titulo
        subtitulo={`CPF ${formatarCpf(cliente.cpf)} · cliente desde ${formatarData(cliente.inicioContrato)}`}
        acoes={
          <>
            <LinkBotao variante="secundario" href={`/consultor/clientes/${id}/editar`}>Editar</LinkBotao>
            <LinkBotao href={`/consultor/empregados/novo?cliente=${id}`}>+ Empregado</LinkBotao>
          </>
        }
      >
        {cliente.nome} {!cliente.ativo && <Selo>inativo</Selo>}
      </Titulo>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Cartao titulo="Empregados">
            <Tabela cabecalho={["Nome", "Função", "Regime", "Salário", `Rotina ${formatarCompetencia(comp.ano, comp.mes)}`]} vazio="Nenhum empregado cadastrado.">
              {cliente.empregados.map((e) => {
                const s = situacaoChecklist(comp.ano, comp.mes, e.competencias[0] ?? {}, hoje);
                return (
                  <tr key={e.id}>
                    <Celula>
                      <Link href={`/consultor/empregados/${e.id}`} className="font-semibold text-marca-700 hover:underline">{e.nome}</Link>
                      {e.situacao !== "ATIVO" && <span className="ml-1"><Selo cor={e.situacao === "AFASTADO" ? "amarelo" : "cinza"}>{e.situacao.toLowerCase()}</Selo></span>}
                    </Celula>
                    <Celula>{e.funcao}</Celula>
                    <Celula>{NOMES_REGIME[e.regime].split(" (")[0]}</Celula>
                    <Celula className="whitespace-nowrap">{formatarMoeda(num(e.salario))}</Celula>
                    <Celula>{e.situacao === "DESLIGADO" ? "—" : <Selo cor={s.status === "ok" ? "verde" : s.status === "atrasado" ? "vermelho" : "amarelo"}>{s.concluidas}/{s.total}</Selo>}</Celula>
                  </tr>
                );
              })}
            </Tabela>
          </Cartao>

          <Cartao titulo={`Diagnóstico de riscos: ${diag.nota}/100 (${diag.classificacao})`} acoes={<LinkBotao pequeno variante="secundario" href={`/consultor/diagnostico?cliente=${id}`}>Detalhes</LinkBotao>}>
            {diag.itens.length === 0 ? <Aviso tipo="sucesso">Nenhum risco encontrado.</Aviso> : (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {diag.itens.slice(0, 6).map((i, n) => <li key={n}><strong>{i.gravidade === "alta" ? "🔴" : i.gravidade === "media" ? "🟡" : "⚪"}</strong> {i.mensagem}</li>)}
              </ul>
            )}
          </Cartao>

          <Cartao titulo="Mensagens prontas (WhatsApp)">
            {!cliente.telefone && <Aviso tipo="aviso">Cadastre o telefone do cliente para usar o WhatsApp.</Aviso>}
            <div className="grid gap-2 sm:grid-cols-2">
              {modelos.map((m) => {
                const texto = preencherModelo(m.texto, valoresMsg);
                return (
                  <a key={m.chave} href={linkWhatsapp(cliente.telefone, texto)} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 p-3 hover:border-[#25D366] hover:bg-emerald-50">
                    <p className="font-semibold">💬 {m.titulo}</p>
                    <p className="line-clamp-3 text-xs text-slate-600">{texto}</p>
                  </a>
                );
              })}
            </div>
          </Cartao>

          <Cartao titulo="Registro de atividades" acoes={<Link className="text-sm font-semibold text-marca-700" href={`/consultor/atividades?cliente=${id}`}>Ver tudo</Link>}>
            <ul className="divide-y divide-slate-100 text-sm">
              {cliente.atividades.map((a) => (
                <li key={a.id} className="py-1.5">
                  <span className="text-slate-500">{a.criadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span> — {a.descricao}
                  {a.usuario && <span className="text-slate-500"> ({a.usuario.nome})</span>}
                </li>
              ))}
            </ul>
          </Cartao>
        </div>

        <div className="space-y-4">
          <Cartao titulo="Dados">
            <dl className="space-y-1 text-sm">
              <div><dt className="inline text-slate-500">Telefone: </dt><dd className="inline">{formatarTelefone(cliente.telefone) || "—"}</dd></div>
              <div><dt className="inline text-slate-500">E-mail: </dt><dd className="inline">{cliente.email ?? "—"}</dd></div>
              <div><dt className="inline text-slate-500">Endereço: </dt><dd className="inline">{[cliente.endereco, cliente.cidade, cliente.uf].filter(Boolean).join(", ") || "—"}</dd></div>
              <div><dt className="inline text-slate-500">Mensalidade: </dt><dd className="inline">{formatarMoeda(num(cliente.mensalidade))} (dia {cliente.diaVencimento})</dd></div>
              <div><dt className="inline text-slate-500">Procuração: </dt><dd className="inline">{cliente.procuracaoStatus.toLowerCase()}{cliente.procuracaoValidade && ` até ${formatarData(cliente.procuracaoValidade)}`}</dd></div>
            </dl>
            {cliente.observacoes && <p className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 p-2 text-sm">{cliente.observacoes}</p>}
            {cliente.telefone && <a className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#25D366] px-4 font-semibold text-white" href={linkWhatsapp(cliente.telefone, `Olá, ${valoresMsg.nome}!`)} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}
          </Cartao>

          <Cartao titulo="Acesso ao portal do cliente">
            {acesso ? (
              <p className="mb-3 text-sm">
                {acesso.ativo ? <Selo cor="verde">ativo</Selo> : <Selo cor="vermelho">desativado</Selo>} {acesso.email}
                <br />
                <span className="text-slate-500">Último acesso: {acesso.ultimoAcesso ? acesso.ultimoAcesso.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "nunca"}</span>
              </p>
            ) : <p className="mb-3 text-sm text-slate-600">O cliente ainda não tem acesso.</p>}
            <Formulario acao={criarAcessoCliente} textoBotao={acesso ? "Gerar nova senha" : "Criar acesso"} variante="secundario">
              <input type="hidden" name="clienteId" value={id} />
              <Campo rotulo="E-mail de acesso" name="email" type="email" required defaultValue={acesso?.email ?? cliente.email ?? ""} />
            </Formulario>
            {acesso?.ativo && <div className="mt-2"><BotaoAcao acao={desativarAcesso} campos={{ usuarioId: acesso.id }} variante="perigo" confirmar="Desativar o acesso do cliente?">Desativar acesso</BotaoAcao></div>}
          </Cartao>

          <Cartao titulo="Mensalidades" acoes={<Link className="text-sm font-semibold text-marca-700" href={`/consultor/financeiro?cliente=${id}`}>Financeiro</Link>}>
            <ul className="space-y-1 text-sm">
              {cliente.mensalidades.map((m) => (
                <li key={m.id} className="flex justify-between">
                  <span>{formatarCompetencia(m.ano, m.mes)} — {formatarMoeda(num(m.valor))}</span>
                  <Selo cor={m.status === "PAGO" ? "verde" : m.vencimento < hoje ? "vermelho" : "amarelo"}>{m.status === "PAGO" ? "pago" : m.vencimento < hoje ? "atrasado" : "aberto"}</Selo>
                </li>
              ))}
              {!cliente.mensalidades.length && <li className="text-slate-500">Nenhuma mensalidade gerada.</li>}
            </ul>
          </Cartao>

          <Cartao titulo={`Tempo dedicado (${Math.floor(tempoTotal / 60)}h${String(tempoTotal % 60).padStart(2, "0")} recentes)`}>
            <Formulario acao={registrarTempo} textoBotao="Registrar tempo" variante="secundario" limparAoSalvar>
              <input type="hidden" name="clienteId" value={id} />
              <Campo rotulo="Tarefa" name="tarefa" required placeholder="Ex.: fechamento da folha" />
              <Grade>
                <Campo rotulo="Minutos" name="minutos" type="number" min={1} required />
                <Campo rotulo="Data" name="data" type="date" />
              </Grade>
            </Formulario>
            <ul className="mt-3 space-y-1 text-xs text-slate-600">
              {cliente.registrosTempo.map((r) => <li key={r.id}>{formatarData(r.data)} — {r.tarefa} ({r.minutos} min)</li>)}
            </ul>
          </Cartao>
        </div>
      </div>
    </>
  );
}
