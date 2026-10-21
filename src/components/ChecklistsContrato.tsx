import { NOMES_RESCISAO, type TipoRescisao } from "@/lib/calculos";
import { Cartao } from "./ui";

const ADMISSAO = [
  "Documento com foto e CPF do empregado",
  "Comprovante de residência e dados bancários (para depósito do salário)",
  "Certidão de nascimento dos filhos até 14 anos (salário-família) e cartão de vacinação",
  "Atestado de saúde ocupacional (ASO) admissional — recomendado",
  "Cadastro no eSocial (evento S-2200) até o dia anterior ao início do trabalho",
  "Contrato de trabalho assinado (gerar em Documentos)",
  "Acordo de compensação/banco de horas, se houver horas a mais (LC 150, art. 2º)",
  "Acordo de 12x36, de intervalo de 30 min ou de viagem, quando aplicável",
  "Opção pelo vale-transporte (por escrito) e endereço para cálculo",
  "Liberar o aplicativo de ponto e colher a ciência do aviso de privacidade",
];

const DESLIGAMENTO: Record<string, string[]> = {
  COMUM: [
    "Simular a rescisão na calculadora e conferir férias vencidas e proporcionais",
    "Registrar o desligamento no eSocial (evento S-2299) e emitir o DAE da rescisão",
    "Pagar as verbas em até 10 dias corridos (CLT, art. 477, § 6º) e colher a assinatura do recibo",
    "Fechar o ponto do último mês e colher a assinatura do espelho",
    "Entregar ao empregado os documentos do desligamento (termo de rescisão, guias)",
  ],
  SEM_JUSTA_CAUSA: ["Entregar o aviso prévio (30 dias + 3 por ano) — trabalhado ou indenizado", "Verificar estabilidade (gestante, acidente) — se houver, a dispensa é proibida", "Informar a chave do FGTS e o seguro-desemprego doméstico"],
  PEDIDO_DEMISSAO: ["Pedido de demissão por escrito, assinado pelo empregado", "Definir se o aviso será cumprido, dispensado ou descontado"],
  JUSTA_CAUSA: ["Usar o módulo disciplinar: dossiê revisado pelo consultor", "Comunicação de justa causa assinada (ou recusa com 2 testemunhas)"],
  ACORDO: ["Termo de acordo assinado pelas duas partes (art. 484-A da CLT)", "Aviso prévio indenizado pela metade; saque de 80% do FGTS"],
  TERMINO_CONTRATO: ["Confirmar a data final do contrato de experiência", "Não há aviso prévio nem seguro-desemprego"],
  FALECIMENTO: ["Certidão de óbito e declaração de dependentes do INSS (ou alvará)", "Verbas pagas aos dependentes habilitados"],
};

export function ChecklistsContrato() {
  return (
    <Cartao titulo="Checklists de admissão e desligamento">
      <details>
        <summary className="cursor-pointer font-semibold text-marca-700">Admissão</summary>
        <ul className="mt-2 space-y-1 text-sm">{ADMISSAO.map((i) => <li key={i}>☐ {i}</li>)}</ul>
      </details>
      <details className="mt-3">
        <summary className="cursor-pointer font-semibold text-marca-700">Desligamento (por tipo)</summary>
        <ul className="mt-2 space-y-1 text-sm">{DESLIGAMENTO.COMUM.map((i) => <li key={i}>☐ {i}</li>)}</ul>
        {Object.entries(DESLIGAMENTO).filter(([k]) => k !== "COMUM").map(([k, itens]) => (
          <div key={k} className="mt-2">
            <p className="text-sm font-semibold">{NOMES_RESCISAO[k as TipoRescisao]}</p>
            <ul className="space-y-1 text-sm">{itens.map((i) => <li key={i}>☐ {i}</li>)}</ul>
          </div>
        ))}
      </details>
    </Cartao>
  );
}
