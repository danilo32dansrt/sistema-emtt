import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoAcao, Formulario } from "@/components/Formulario";
import { AreaTexto, Aviso, Campo, Cartao, Celula, Grade, LinkBotao, Selecao, Selo, Tabela, Titulo } from "@/components/ui";
import {
  addMeses, DIAS_SEMANA, diasAvisoPrevio, formatarCpf, formatarData, formatarMoeda, hojeBrasil, idade, NOMES_DIAS_SEMANA, NOMES_REGIME, NOMES_RESCISAO, salarioMinimoProporcional, type RegraFeriasParcial,
} from "@/lib/calculos";
import { jornadaDoEmpregado, num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { feriasDoEmpregado, validacoesDoEmpregado } from "@/lib/servicos/empregado";
import { configuracao, tabelaDoAno } from "@/lib/tabelas-db";
import {
  criarAcessoEmpregado, encerrarAfastamento, excluirFerias, registrarAfastamento, registrarDesligamento, registrarFerias, registrarOcorrencia,
} from "../acoes";

const COR_STATUS = { EM_AQUISICAO: "azul", A_GOZAR: "amarelo", VENCIDO: "vermelho", GOZADO: "verde" } as const;
const NOME_STATUS = { EM_AQUISICAO: "Em aquisição", A_GOZAR: "A gozar", VENCIDO: "Vencido (dobro)", GOZADO: "Gozado" };

export default async function DetalheEmpregado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hoje = hojeBrasil();
  const e = await prisma.empregado.findUnique({
    where: { id },
    include: {
      cliente: true,
      ferias: { orderBy: { inicioGozo: "desc" } },
      afastamentos: { orderBy: { inicio: "desc" } },
      historico: { orderBy: { data: "desc" } },
      usuario: true,
    },
  });
  if (!e) notFound();
  const [cfg, { tabela }] = await Promise.all([configuracao(), tabelaDoAno(hoje.getUTCFullYear())]);
  const validacoes = await validacoesDoEmpregado(e, hoje);
  const { periodos, direito } = feriasDoEmpregado(e, cfg.regraFeriasParcial as RegraFeriasParcial, hoje);
  const jornada = jornadaDoEmpregado(e);
  const minimo = salarioMinimoProporcional(tabela.salarioMinimo, num(e.horasSemanais));
  const periodoAberto = periodos.find((p) => p.status === "VENCIDO" || p.status === "A_GOZAR");
  const desligado = e.situacao === "DESLIGADO";

  return (
    <>
      <Titulo
        subtitulo={<>Empregado(a) de <Link className="font-semibold text-marca-700" href={`/consultor/clientes/${e.clienteId}`}>{e.cliente.nome}</Link> · CPF {formatarCpf(e.cpf)}</>}
        acoes={
          <>
            <LinkBotao variante="secundario" href={`/consultor/empregados/${id}/editar`}>Editar</LinkBotao>
            <LinkBotao variante="secundario" href={`/consultor/calculadora?empregado=${id}`}>Calcular</LinkBotao>
            <LinkBotao href={`/consultor/documentos?empregado=${id}`}>Documentos</LinkBotao>
          </>
        }
      >
        {e.nome} <Selo cor={e.situacao === "ATIVO" ? "verde" : e.situacao === "AFASTADO" ? "amarelo" : "cinza"}>{e.situacao.toLowerCase()}</Selo>
      </Titulo>

      {validacoes.length > 0 && (
        <div className="mb-4 space-y-2">
          {validacoes.map((v) => <Aviso key={v.codigo} tipo={v.severidade === "critico" ? "critico" : v.severidade === "aviso" ? "aviso" : "info"}>{v.mensagem}</Aviso>)}
        </div>
      )}
      {e.estabilidadeAte && e.estabilidadeAte >= hoje && <div className="mb-4"><Aviso tipo="aviso" titulo="Estabilidade provisória">{e.estabilidadeMotivo} até {formatarData(e.estabilidadeAte)}. Dispensa sem justa causa bloqueada.</Aviso></div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Cartao titulo="Contrato">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div><dt className="inline text-slate-500">Função: </dt><dd className="inline">{e.funcao} (CBO {e.cbo})</dd></div>
              <div><dt className="inline text-slate-500">Admissão: </dt><dd className="inline">{formatarData(e.admissao)}</dd></div>
              <div><dt className="inline text-slate-500">Salário: </dt><dd className="inline font-semibold">{formatarMoeda(num(e.salario))}</dd> <span className="text-slate-500">(mínimo proporcional {formatarMoeda(minimo)})</span></div>
              <div><dt className="inline text-slate-500">Regime: </dt><dd className="inline">{NOMES_REGIME[e.regime]} — {num(e.horasSemanais)}h/semana</dd></div>
              {e.nascimento && <div><dt className="inline text-slate-500">Nascimento: </dt><dd className="inline">{formatarData(e.nascimento)} ({idade(e.nascimento, hoje)} anos)</dd></div>}
              {e.diasExperiencia && <div><dt className="inline text-slate-500">Experiência: </dt><dd className="inline">{e.diasExperiencia} dias (até {formatarData(new Date(e.admissao.getTime() + (e.diasExperiencia - 1) * 86400000))})</dd></div>}
              <div><dt className="inline text-slate-500">Aviso prévio hoje: </dt><dd className="inline">{diasAvisoPrevio(e.admissao, hoje)} dias</dd></div>
              <div><dt className="inline text-slate-500">Acordos: </dt><dd className="inline">{[e.acordoCompensacao && "compensação", e.acordoIntervaloReduzido && "intervalo 30min", e.acordo12x36 && "12x36", e.acordoViagem && "viagem"].filter(Boolean).join(", ") || "nenhum"}</dd></div>
              {desligado && <div><dt className="inline text-slate-500">Desligamento: </dt><dd className="inline">{formatarData(e.desligamento)} — {e.motivoDesligamento}</dd></div>}
            </dl>
            <div className="mt-3 flex flex-wrap gap-1">
              {DIAS_SEMANA.map((d) => <span key={d} className={`rounded-lg px-2 py-1 text-xs ${jornada[d] ? "bg-marca-50 text-marca-700" : "bg-slate-100 text-slate-400"}`}>{NOMES_DIAS_SEMANA[d].slice(0, 3)} {jornada[d] ? `${jornada[d]}h` : "folga"}</span>)}
            </div>
          </Cartao>

          <Cartao titulo={`Férias (${direito.dias} dias por período)`}>
            <p className="mb-2 text-xs text-slate-500">{direito.fundamento}</p>
            <Tabela cabecalho={["Período aquisitivo", "Concessivo até", "Gozados", "Situação"]}>
              {periodos.map((p) => (
                <tr key={p.numero}>
                  <Celula>{formatarData(p.inicioAquisitivo)} a {formatarData(p.fimAquisitivo)}</Celula>
                  <Celula>{formatarData(p.fimConcessivo)}{p.status === "A_GOZAR" && <span className="block text-xs text-slate-500">faltam {p.diasParaVencer} dias</span>}</Celula>
                  <Celula>{p.diasGozados}</Celula>
                  <Celula><Selo cor={COR_STATUS[p.status]}>{NOME_STATUS[p.status]}</Selo></Celula>
                </tr>
              ))}
            </Tabela>
            {e.ferias.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {e.ferias.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-2">
                    <span>🏖️ {formatarData(f.inicioGozo)} — {f.dias} dias{f.diasAbono ? ` + ${f.diasAbono} de abono` : ""} (período de {formatarData(f.inicioAquisitivo)})</span>
                    <BotaoAcao acao={excluirFerias} campos={{ id: f.id }} confirmar="Excluir este registro de férias?">Excluir</BotaoAcao>
                  </li>
                ))}
              </ul>
            )}
            {!desligado && (
              <details className="mt-3 rounded-xl border border-slate-200 p-3">
                <summary className="cursor-pointer font-semibold text-marca-700">Programar / registrar férias</summary>
                <Formulario acao={registrarFerias} textoBotao="Registrar férias" className="mt-3" limparAoSalvar>
                  <input type="hidden" name="empregadoId" value={id} />
                  <input type="hidden" name="diasDireito" value={direito.dias} />
                  <Grade>
                    <Selecao rotulo="Período aquisitivo" name="inicioAquisitivo" defaultValue={periodoAberto?.inicioAquisitivo.toISOString().slice(0, 10)} opcoes={periodos.filter((p) => p.status !== "GOZADO").map((p) => ({ valor: p.inicioAquisitivo.toISOString().slice(0, 10), rotulo: `${formatarData(p.inicioAquisitivo)} a ${formatarData(p.fimAquisitivo)}` }))} />
                    <Campo rotulo="Início do gozo" name="inicioGozo" type="date" required />
                    <Campo rotulo="Dias de gozo" name="dias" type="number" min={1} max={30} required defaultValue={direito.dias} />
                    <Campo rotulo="Dias de abono (venda)" name="diasAbono" type="number" min={0} max={10} defaultValue={0} />
                    <Campo rotulo="Valor líquido pago (opcional)" name="valorLiquido" inputMode="decimal" />
                  </Grade>
                  <p className="text-xs text-slate-500">Até 2 períodos, um deles com 14 dias ou mais. Aviso com 30 dias e pagamento até 2 dias antes.</p>
                </Formulario>
              </details>
            )}
          </Cartao>

          <Cartao titulo="Afastamentos">
            {e.situacao === "AFASTADO" && <div className="mb-2"><BotaoAcao acao={encerrarAfastamento} campos={{ empregadoId: id }} variante="sucesso">Registrar retorno ao trabalho</BotaoAcao></div>}
            <ul className="space-y-1 text-sm">
              {e.afastamentos.map((a) => <li key={a.id}>• {a.tipo.toLowerCase().replace(/_/g, " ")}: {formatarData(a.inicio)}{a.fim ? ` a ${formatarData(a.fim)}` : " (sem data de fim)"}{a.observacoes ? ` — ${a.observacoes}` : ""}</li>)}
              {!e.afastamentos.length && <li className="text-slate-500">Nenhum afastamento.</li>}
            </ul>
            {!desligado && (
              <details className="mt-3 rounded-xl border border-slate-200 p-3">
                <summary className="cursor-pointer font-semibold text-marca-700">Registrar afastamento</summary>
                <Formulario acao={registrarAfastamento} textoBotao="Registrar" className="mt-3" limparAoSalvar>
                  <input type="hidden" name="empregadoId" value={id} />
                  <Grade>
                    <Selecao rotulo="Tipo" name="tipo" opcoes={[
                      { valor: "ATESTADO", rotulo: "Atestado médico (até 15 dias)" },
                      { valor: "LICENCA_MATERNIDADE", rotulo: "Licença-maternidade (120 dias, INSS)" },
                      { valor: "AUXILIO_INCAPACIDADE", rotulo: "Auxílio por incapacidade (INSS desde o 1º dia)" },
                      { valor: "ACIDENTE_TRABALHO", rotulo: "Acidente de trabalho" },
                      { valor: "OUTRO", rotulo: "Outro" },
                    ]} />
                    <Campo rotulo="Início" name="inicio" type="date" required />
                    <Campo rotulo="Fim (se souber)" name="fim" type="date" />
                    <Campo rotulo="Observações" name="observacoes" />
                  </Grade>
                </Formulario>
              </details>
            )}
          </Cartao>

          <Cartao titulo="Histórico (linha do tempo)">
            <ol className="relative ml-3 border-l-2 border-marca-100">
              {e.historico.map((h) => (
                <li key={h.id} className="mb-3 ml-4">
                  <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-marca-500" />
                  <p className="text-xs font-semibold text-slate-500">{formatarData(h.data)} · {h.tipo.toLowerCase().replace(/_/g, " ")}</p>
                  <p className="text-sm">{h.descricao}</p>
                </li>
              ))}
            </ol>
            <details className="mt-2 rounded-xl border border-slate-200 p-3">
              <summary className="cursor-pointer font-semibold text-marca-700">Registrar ocorrência</summary>
              <Formulario acao={registrarOcorrencia} textoBotao="Registrar" className="mt-3" limparAoSalvar>
                <input type="hidden" name="empregadoId" value={id} />
                <Campo rotulo="Data" name="data" type="date" required />
                <AreaTexto rotulo="Descrição" name="descricao" required />
              </Formulario>
            </details>
          </Cartao>
        </div>

        <div className="space-y-4">
          <Cartao titulo="Aplicativo de ponto">
            {e.usuario ? (
              <p className="mb-2 text-sm">{e.usuario.ativo ? <Selo cor="verde">acesso ativo</Selo> : <Selo cor="vermelho">desativado</Selo>} {e.usuario.email}</p>
            ) : <p className="mb-2 text-sm text-slate-600">Sem acesso ao aplicativo.</p>}
            {!desligado && (
              <Formulario acao={criarAcessoEmpregado} textoBotao={e.usuario ? "Gerar nova senha" : "Liberar acesso ao ponto"} variante="secundario">
                <input type="hidden" name="empregadoId" value={id} />
                <Campo rotulo="E-mail do empregado" name="email" type="email" required defaultValue={e.usuario?.email ?? ""} />
              </Formulario>
            )}
            <LinkBotao className="mt-3 w-full" variante="fantasma" href={`/consultor/ponto/${id}`}>Ver marcações e espelho</LinkBotao>
          </Cartao>

          {!desligado && (
            <Cartao titulo="Desligamento">
              <p className="mb-2 text-sm text-slate-600">Antes, simule na <Link className="font-semibold text-marca-700" href={`/consultor/calculadora?empregado=${id}&aba=rescisao`}>calculadora de rescisão</Link>.</p>
              <Formulario acao={registrarDesligamento} textoBotao="Registrar desligamento" variante="perigo" confirmar="Confirmar o desligamento? O acesso ao ponto será encerrado.">
                <input type="hidden" name="empregadoId" value={id} />
                <Campo rotulo="Último dia trabalhado" name="data" type="date" required />
                <Selecao rotulo="Tipo" name="tipo" opcoes={Object.entries(NOMES_RESCISAO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
                <AreaTexto rotulo="Observações" name="observacoes" />
              </Formulario>
            </Cartao>
          )}

          <Cartao titulo="Benefícios">
            <ul className="space-y-1 text-sm">
              <li>Salário-família: {e.dependentesSalarioFamilia} dependente(s) {num(e.salario) <= tabela.salarioFamiliaLimite && e.dependentesSalarioFamilia > 0 ? <Selo cor="verde">tem direito</Selo> : null}</li>
              <li>Vale-transporte: {e.custoValeTransporte ? formatarMoeda(num(e.custoValeTransporte)) : "não usa"}</li>
              {e.gestante && <li>Gestante — parto previsto {formatarData(e.dataPrevistaParto)}; estabilidade até {formatarData(e.estabilidadeAte ?? (e.dataPrevistaParto ? addMeses(e.dataPrevistaParto, 5) : null))}</li>}
            </ul>
          </Cartao>
        </div>
      </div>
    </>
  );
}
