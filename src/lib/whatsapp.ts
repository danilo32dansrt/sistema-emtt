import { somenteDigitos } from "./calculos";

/** Substitui [chave] no modelo pelos valores informados. */
export function preencherModelo(modelo: string, valores: Record<string, string>): string {
  return modelo.replace(/\[([^\]]+)\]/g, (todo, chave: string) => valores[chave.trim().toLowerCase()] ?? todo);
}

/** Link para abrir o WhatsApp com a mensagem pronta. */
export function linkWhatsapp(telefone: string | null | undefined, mensagem: string): string {
  let t = somenteDigitos(telefone ?? "");
  if (t && !t.startsWith("55")) t = `55${t}`;
  return `https://wa.me/${t}?text=${encodeURIComponent(mensagem)}`;
}

export const MODELOS_PADRAO = [
  {
    chave: "enviar_dae",
    titulo: "Enviar DAE",
    texto: "Olá, [nome]! Segue o DAE de [mês], no valor de [valor], com vencimento em [data]. Me avise quando pagar, por favor.",
  },
  {
    chave: "pedir_informacoes",
    titulo: "Pedir informações do mês",
    texto: "Olá, [nome]! Para fecharmos a folha de [mês], me envie até o dia 30: faltas, horas extras e adiantamentos de [empregado]. Se não houve nada, é só responder \"sem alterações\". Obrigado!",
  },
  {
    chave: "cobrar_mensalidade",
    titulo: "Cobrar mensalidade",
    texto: "Olá, [nome]! A mensalidade da consultoria de [mês], no valor de [valor], vence em [data]. Chave Pix: [pix]. Obrigado!",
  },
  {
    chave: "avisar_ferias",
    titulo: "Avisar férias",
    texto: "Olá, [nome]! As férias de [empregado] precisam ser avisadas por escrito até [data]. O pagamento (férias + 1/3) deve ser feito até 2 dias antes do início. Posso preparar o aviso?",
  },
  {
    chave: "avisar_13",
    titulo: "Avisar 13º salário",
    texto: "Olá, [nome]! Lembrete do 13º de [empregado]: 1ª parcela até 30/11 e 2ª parcela com o DAE do 13º até 20/12. Valor estimado: [valor].",
  },
];
