import Link from "next/link";
import { AtivarAvisos } from "@/components/AtivarAvisos";
import { ListaAgenda } from "@/components/ListaAgenda";
import { Pendencias } from "@/components/Pendencias";
import { Aviso, Cartao, LinkBotao, Selo, Titulo } from "@/components/ui";
import { exigirCliente } from "@/lib/auth/sessao";
import { addDias, formatarCompetencia, formatarData, formatarMoeda, hojeBrasil, provisaoMensal } from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { chavePublicaPush } from "@/lib/notificacoes";
import { pendenciasDoPatrao } from "@/lib/servicos/lembretes";
import { agendaDoBanco } from "@/lib/servicos/agenda";
import { competenciaPadrao } from "@/lib/servicos/competencia";
import { tabelaDoAno } from "@/lib/tabelas-db";

export const metadata = { title: "Início" };

export default async function InicioCliente() {
  const u = await exigirCliente();
  const hoje = hojeBrasil();
  const comp = competenciaPadrao(hoje);
  const [empregados, agenda, mensalidade, assinar, { tabela }] = await Promise.all([
    prisma.empregado.findMany({ where: { clienteId: u.clienteId, situacao: { not: "DESLIGADO" } }, include: { competencias: { where: { ano: comp.ano, mes: comp.mes } }, lancamentos: { where: { ano: comp.ano, mes: comp.mes } } } }),
    agendaDoBanco({ clienteId: u.clienteId, de: hoje, ate: addDias(hoje, 60), hoje }),
    prisma.mensalidade.findFirst({ where: { clienteId: u.clienteId, status: "ABERTO" }, orderBy: { vencimento: "asc" } }),
    prisma.documento.count({ where: { clienteId: u.clienteId, exigeAssinaturaCliente: true, visivelCliente: true, assinaturas: { none: { papel: "CLIENTE" } } } }),
    tabelaDoAno(hoje.getUTCFullYear()),
  ]);
  const provisao = empregados.reduce((t, e) => t + provisaoMensal(num(e.salario), tabela).total, 0);

  return (
    <>
      <Titulo subtitulo={`Competência ${formatarCompetencia(comp.ano, comp.mes)}`}>Olá, {u.nome.split(" ")[0]}!</Titulo>
      <Pendencias itens={await pendenciasDoPatrao(u.clienteId!)} />
      <div className="mb-4 space-y-2">
        <AtivarAvisos chavePublica={chavePublicaPush()} compacto />
        {assinar > 0 && <Aviso tipo="aviso">Você tem {assinar} documento(s) para assinar. <Link className="font-semibold underline" href="/cliente/documentos">Assinar agora</Link></Aviso>}
        {mensalidade && mensalidade.vencimento < hoje && <Aviso tipo="critico">Mensalidade {formatarCompetencia(mensalidade.ano, mensalidade.mes)} vencida em {formatarData(mensalidade.vencimento)}. <Link className="font-semibold underline" href="/cliente/mensalidade">Pagar com Pix</Link></Aviso>}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {empregados.map((e) => {
            const c = e.competencias[0];
            const l = e.lancamentos[0];
            const etapas = [
              { ok: Boolean(l || c?.infoRecebida), rotulo: "Informações do mês enviadas" },
              { ok: Boolean(c?.folhaEncerrada), rotulo: "Folha encerrada" },
              { ok: Boolean(c?.daeEmitido), rotulo: `DAE disponível${c?.daeValor ? ` (${formatarMoeda(num(c.daeValor))})` : ""}` },
              { ok: Boolean(c?.pagamentoConfirmado || c?.clienteInformouPagamentoEm), rotulo: "DAE pago" },
            ];
            return (
              <Cartao key={e.id} titulo={e.nome} acoes={!l && !c?.folhaEncerrada ? <LinkBotao pequeno href={`/cliente/informar?empregado=${e.id}`}>Informar o mês</LinkBotao> : undefined}>
                <p className="mb-2 text-sm text-slate-600">{e.funcao} · salário {formatarMoeda(num(e.salario))}</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {etapas.map((x) => <li key={x.rotulo} className="flex items-center gap-2 text-sm"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${x.ok ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}>{x.ok ? "✓" : "…"}</span>{x.rotulo}</li>)}
                </ul>
                {c?.daeEmitido && !c.pagamentoConfirmado && !c.clienteInformouPagamentoEm && <div className="mt-3"><LinkBotao pequeno variante="sucesso" href="/cliente/dae">Já paguei o DAE</LinkBotao></div>}
              </Cartao>
            );
          })}
          {!empregados.length && <Aviso>Nenhum empregado ativo cadastrado.</Aviso>}
          <Cartao titulo="Próximos compromissos" acoes={<Link className="text-sm font-semibold text-marca-700" href="/cliente/calendario">Calendário completo</Link>}>
            <ListaAgenda eventos={agenda.slice(0, 8)} hoje={hoje} />
          </Cartao>
        </div>
        <div className="space-y-4">
          <Cartao titulo="Quanto guardar por mês">
            <p className="text-3xl font-bold text-marca-700">{formatarMoeda(provisao)}</p>
            <p className="text-sm text-slate-600">Provisão para 13º, férias + 1/3, encargos e uma eventual rescisão.</p>
            <Link className="mt-2 inline-block text-sm font-semibold text-marca-700" href="/cliente/custos">Ver painel de custos</Link>
          </Cartao>
          {mensalidade && (
            <Cartao titulo="Mensalidade da consultoria">
              <p className="text-2xl font-bold">{formatarMoeda(num(mensalidade.valor))}</p>
              <p className="text-sm text-slate-600">Vence em {formatarData(mensalidade.vencimento)} {mensalidade.vencimento < hoje && <Selo cor="vermelho">atrasada</Selo>}</p>
              <LinkBotao className="mt-2" pequeno href="/cliente/mensalidade">Pagar com Pix</LinkBotao>
            </Cartao>
          )}
          <Cartao titulo="Precisa de ajuda?">
            <LinkBotao className="w-full" variante="secundario" href="/cliente/mensagens">💬 Falar com o consultor</LinkBotao>
          </Cartao>
        </div>
      </div>
    </>
  );
}
