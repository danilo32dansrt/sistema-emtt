import "server-only";
import { prisma } from "@/lib/db";
import { notificar, type Aviso } from "@/lib/notificacoes";

/**
 * Teste dos avisos nos celulares: manda um exemplo de cada tipo de aviso (os mesmos textos e botões dos lembretes
 * reais) para o consultor, os patrões de um cliente e as empregadas dele. Serve para conferir, com os apps
 * instalados, que chega tudo — inclusive com a tela bloqueada — sem esperar o horário de cada lembrete.
 */

export type GrupoTeste = "EMPREGADO" | "CLIENTE" | "CONSULTOR";

const EXEMPLOS: Record<GrupoTeste, (nome: string) => Omit<Aviso, "chave">[]> = {
  EMPREGADO: () => [
    { titulo: "A entrada de hoje ainda não foi lançada", texto: "Seu horário começou às 08:00. Marque a entrada agora; se chegou mais cedo e esqueceu, peça o ajuste.", link: "/ponto", acao: "Marcar entrada agora" },
    { titulo: "O intervalo ainda não foi lançado", texto: "Faça o seu intervalo e marque a saída para o intervalo.", link: "/ponto", acao: "Marcar intervalo agora" },
    { titulo: "A volta do intervalo ainda não foi lançada", texto: "Marque a volta do intervalo.", link: "/ponto", acao: "Marcar volta agora" },
    { titulo: "A saída de hoje ainda não foi lançada", texto: "Já terminou o dia? Marque a saída (horário previsto: 17:00).", link: "/ponto", acao: "Marcar saída agora" },
    { titulo: "Dia de ontem sem marcação", texto: "Se você faltou, envie a justificativa. Se trabalhou e esqueceu, toque em “Trabalhei no meu horário”.", link: "/ponto", acao: "Resolver" },
    { titulo: "Ajuste do ponto aprovado", texto: "Já está no seu espelho do mês.", link: "/ponto/historico", acao: "Ver meu mês" },
    { titulo: "Ponto do mês fechado", texto: "O espelho do mês está no app para você conferir e assinar.", link: "/ponto/historico", acao: "Ver meu mês" },
  ],
  CLIENTE: (nome) => [
    { titulo: `${nome} ainda não marcou a entrada`, texto: "O horário de hoje começava às 08:00. Se ela veio e esqueceu, combinem o ajuste; se faltou, registre no ponto.", link: "/cliente", acao: "Ver o ponto de hoje" },
    { titulo: `${nome} pediu ajuste no ponto`, texto: "Diz que trabalhou no horário normal (08:00–17:00). Aprove ou recuse num toque.", link: "/cliente", acao: "Responder" },
    { titulo: `${nome}: dia de ontem sem marcação`, texto: "Trabalhou no horário normal, faltou ou abonar? Resolva num toque.", link: "/cliente", acao: "Resolver o dia" },
    { titulo: `Feche o ponto do mês — ${nome}`, texto: "Resumo pronto: nenhuma falta, 2 h extras. Confira e toque em “Confirmar”.", link: "/cliente", acao: "Confirmar o mês" },
    { titulo: "DAE vence em 3 dias", texto: "Pague no app do banco e toque em “Já paguei”.", link: "/cliente/dae", acao: "Pagar o DAE agora" },
    { titulo: "Hoje vence a cobrança do mês", texto: "Plano Plus: mensalidade + DAE. Com o pagamento, a consultoria paga o DAE por você.", link: "/cliente/mensalidade", acao: "Pagar agora" },
    { titulo: "DAE pago pela consultoria", texto: "O comprovante está no app.", link: "/cliente/dae", acao: "Ver o DAE" },
  ],
  CONSULTOR: () => [
    { titulo: "Hoje: obrigações em aberto", texto: "DAEs para emitir · pagamentos para confirmar · pedidos de ponto · mensagens de clientes.", link: "/consultor", acao: "Abrir o painel" },
    { titulo: "Emitir as guias do DAE hoje", texto: "DAEs da competência ainda não emitidos. O DAE vence no dia 7.", link: "/consultor/rotina", acao: "Emitir agora" },
    { titulo: "DAE vence hoje", texto: "Há DAE sem pagamento confirmado. Confira com os clientes.", link: "/consultor/rotina", acao: "Conferir pagamentos" },
    { titulo: "Cliente fechou o ponto do mês", texto: "Faltas, atrasos e extras já calculados para lançar na folha.", link: "/consultor/rotina", acao: "Lançar na folha" },
    { titulo: "Pague o DAE do cliente Plus", texto: "Dinheiro recebido. Pague e marque como pago.", link: "/consultor/financeiro", acao: "Pagar agora" },
    { titulo: "Dossiê de justa causa esperando você", texto: "O empregador não pode finalizar sem a sua revisão.", link: "/consultor/disciplinar", acao: "Revisar agora" },
    { titulo: "Mensagem de cliente", texto: "Há clientes esperando resposta no chat.", link: "/consultor/mensagens", acao: "Responder" },
  ],
};

/** Envia os exemplos e devolve quantos avisos foram criados por grupo (e quantos celulares estão inscritos). */
export async function enviarAvisosDeTeste(opcoes: { clienteId: string; consultorId: string; grupos: GrupoTeste[] }) {
  const marca = Date.now();
  const empregados = await prisma.empregado.findMany({ where: { clienteId: opcoes.clienteId, situacao: { not: "DESLIGADO" } }, select: { nome: true, usuario: { select: { id: true, ativo: true } } } });
  const nomeEmpregada = empregados[0]?.nome.split(" ")[0] ?? "A empregada";
  const destinos: { grupo: GrupoTeste; usuarioIds: string[] }[] = [
    { grupo: "EMPREGADO", usuarioIds: empregados.flatMap((e) => (e.usuario?.ativo ? [e.usuario.id] : [])) },
    { grupo: "CLIENTE", usuarioIds: (await prisma.usuario.findMany({ where: { clienteId: opcoes.clienteId, papel: "CLIENTE", ativo: true }, select: { id: true } })).map((u) => u.id) },
    { grupo: "CONSULTOR", usuarioIds: [opcoes.consultorId] },
  ];
  const resultado: Record<string, { avisos: number; celulares: number; pessoas: number }> = {};
  for (const d of destinos.filter((x) => opcoes.grupos.includes(x.grupo))) {
    const exemplos = EXEMPLOS[d.grupo](nomeEmpregada);
    let avisos = 0;
    for (const id of d.usuarioIds) {
      for (const [i, ex] of exemplos.entries()) if (await notificar(id, { ...ex, titulo: `[TESTE] ${ex.titulo}`, chave: `teste:${marca}:${d.grupo}:${i}` })) avisos++;
    }
    resultado[d.grupo] = { avisos, pessoas: d.usuarioIds.length, celulares: await prisma.inscricaoPush.count({ where: { usuarioId: { in: d.usuarioIds } } }) };
  }
  return resultado;
}
