import { BotaoAcao, Formulario } from "@/components/Formulario";
import { AreaTexto, Aviso, Campo, Cartao, Celula, Grade, LinkBotao, Marcador, Selecao, Selo, Tabela, Titulo } from "@/components/ui";
import { formatarMoeda } from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { configuracao, modelosMensagem } from "@/lib/tabelas-db";
import { configInter } from "@/lib/inter/api";
import { cadastrarWebhookInter, removerPreco, salvarCobrancaInter, salvarConfiguracao, salvarModelo, salvarPreco, testarConexaoInter } from "./acoes";

export const metadata = { title: "Configurações" };

export default async function Configuracoes() {
  const [cfg, precos, modelos] = await Promise.all([configuracao(), prisma.tabelaPreco.findMany({ where: { ativo: true }, orderBy: { servico: "asc" } }), modelosMensagem()]);
  const inter = configInter();
  return (
    <>
      <Titulo acoes={<LinkBotao variante="secundario" href="/consultor/conta">Minha senha</LinkBotao>}>Configurações</Titulo>
      <div className="space-y-4">
        <Cartao titulo="Dados da consultoria (aparecem nos documentos e no Pix)">
          <Formulario acao={salvarConfiguracao}>
            <Grade colunas={3}>
              <Campo rotulo="Nome da consultoria" name="nomeConsultoria" required defaultValue={cfg.nomeConsultoria} />
              <Campo rotulo="CPF/CNPJ" name="documento" defaultValue={cfg.documento ?? ""} />
              <Campo rotulo="Telefone" name="telefone" defaultValue={cfg.telefone ?? ""} />
              <Campo rotulo="E-mail" name="email" defaultValue={cfg.email ?? ""} />
              <Campo rotulo="Endereço" name="endereco" defaultValue={cfg.endereco ?? ""} />
              <Grade>
                <Campo rotulo="Cidade" name="cidade" defaultValue={cfg.cidade ?? ""} />
                <Campo rotulo="UF" name="uf" maxLength={2} defaultValue={cfg.uf ?? ""} />
              </Grade>
              <Campo rotulo="Chave Pix" name="chavePix" defaultValue={cfg.chavePix ?? ""} />
              <Campo rotulo="Nome do recebedor Pix" name="nomePix" defaultValue={cfg.nomePix ?? ""} />
              <Campo rotulo="Cidade do recebedor Pix" name="cidadePix" defaultValue={cfg.cidadePix ?? ""} />
            </Grade>
            <Grade>
              <Selecao rotulo="Férias no tempo parcial" name="regraFeriasParcial" defaultValue={cfg.regraFeriasParcial} opcoes={[{ valor: "CLT", rotulo: "30 dias (CLT após a Reforma — mais seguro)" }, { valor: "LC150", rotulo: "Tabela da LC 150, art. 3º, § 3º (8 a 18 dias)" }]} ajuda="Ponto controverso: confirme com o seu advogado trabalhista." />
            </Grade>
          </Formulario>
        </Cartao>

        <div id="inter">
          <Cartao titulo="Cobrança automática das mensalidades (Banco Inter PJ)" acoes={inter.configurado ? <Selo cor={inter.ambiente === "producao" ? "verde" : "amarelo"}>{inter.ambiente === "producao" ? "produção" : "ambiente de testes"}</Selo> : <Selo>não configurado</Selo>}>
            <p className="mb-3 text-sm text-slate-600">O sistema emite todo mês a cobrança de cada cliente (Pix com QR Code + boleto) pela conta PJ do Inter e dá baixa sozinho quando o pagamento cai. As chaves de acesso ficam só no arquivo <code>.env</code>, nunca aqui na tela.</p>
            {!inter.configurado && <div className="mb-3"><Aviso tipo="aviso" titulo="Falta configurar no .env">{inter.faltando.join(", ")}. Veja o passo a passo no README, seção “Cobrança automática pelo Banco Inter”.</Aviso></div>}
            <Formulario acao={salvarCobrancaInter}>
              <Marcador rotulo="Emitir as cobranças pelo Inter automaticamente (todo dia 1º e ao gerar as mensalidades)" name="cobrancaInter" defaultChecked={cfg.cobrancaInter} disabled={!inter.configurado && !cfg.cobrancaInter} />
              <Grade colunas={3}>
                <Campo rotulo="Multa por atraso (%)" name="multaMensalidade" inputMode="decimal" defaultValue={String(num(cfg.multaMensalidade)).replace(".", ",")} ajuda="Conforme o contrato. Em relação de consumo (CDC, art. 52), a multa é limitada a 2%." />
                <Campo rotulo="Juros ao mês (%)" name="jurosMensalidade" inputMode="decimal" defaultValue={String(num(cfg.jurosMensalidade)).replace(".", ",")} ajuda="Conforme o contrato (usualmente 1% ao mês)." />
                <Campo rotulo="Cancelar sozinho após (dias)" name="diasBaixaInter" type="number" min={0} max={60} defaultValue={cfg.diasBaixaInter} ajuda="Dias depois do vencimento em que o banco tira do ar a cobrança não paga (0 a 60)." />
              </Grade>
            </Formulario>
            {inter.configurado && (
              <div className="mt-3 flex flex-wrap gap-2">
                <BotaoAcao acao={testarConexaoInter}>Testar conexão</BotaoAcao>
                <BotaoAcao acao={cadastrarWebhookInter}>Cadastrar aviso de pagamento no Inter</BotaoAcao>
              </div>
            )}
          </Cartao>
        </div>

        <Cartao titulo="Tabela de preços">
          <Tabela cabecalho={["Serviço", "Valor", "Unidade", ""]} vazio="Nenhum preço cadastrado.">
            {precos.map((p) => (
              <tr key={p.id}>
                <Celula>{p.servico}{p.descricao && <span className="block text-xs text-slate-500">{p.descricao}</span>}</Celula>
                <Celula>{formatarMoeda(num(p.valor))}</Celula>
                <Celula>{p.unidade.replace("_", " ")}</Celula>
                <Celula><BotaoAcao acao={removerPreco} campos={{ id: p.id }} confirmar="Remover este preço?">Remover</BotaoAcao></Celula>
              </tr>
            ))}
          </Tabela>
          <details className="mt-3">
            <summary className="cursor-pointer font-semibold text-marca-700">Adicionar ou alterar preço</summary>
            <Formulario acao={salvarPreco} className="mt-3" limparAoSalvar>
              <Grade colunas={4}>
                <Campo rotulo="Serviço" name="servico" required placeholder="Ex.: Mensalidade (1 empregado)" />
                <Campo rotulo="Descrição" name="descricao" />
                <Campo rotulo="Valor (R$)" name="valor" inputMode="decimal" required />
                <Selecao rotulo="Unidade" name="unidade" opcoes={[{ valor: "mensal", rotulo: "Mensal" }, { valor: "por_empregado", rotulo: "Mensal por empregado" }, { valor: "avulso", rotulo: "Avulso" }]} />
              </Grade>
            </Formulario>
          </details>
        </Cartao>

        <Cartao titulo="Modelos de mensagem (WhatsApp)">
          <p className="mb-3 text-sm text-slate-600">Use [nome], [mês], [valor], [data], [empregado] e [pix] — o sistema troca pelos dados reais.</p>
          <div className="space-y-4">
            {modelos.map((m) => (
              <Formulario key={m.chave} acao={salvarModelo} textoBotao="Salvar modelo" variante="secundario" pequeno>
                <input type="hidden" name="chave" value={m.chave} />
                <Campo rotulo="Título" name="titulo" defaultValue={m.titulo} />
                <AreaTexto rotulo="Texto" name="texto" defaultValue={m.texto} />
              </Formulario>
            ))}
          </div>
        </Cartao>
      </div>
    </>
  );
}
