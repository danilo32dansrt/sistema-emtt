import { Casca } from "@/components/Casca";
import { exigirConsultor } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { quantidadeParametrosPendentes } from "@/lib/servicos/parametros";

export const metadata = { manifest: "/manifest-consultor.webmanifest", appleWebApp: { capable: true, title: "Consultoria", statusBarStyle: "default" as const } };

export default async function LayoutConsultor({ children }: { children: React.ReactNode }) {
  const u = await exigirConsultor();
  const [ajustes, justificativas, mensagens, disciplinar, parametrosPendentes, avisos] = await Promise.all([
    prisma.ajustePonto.count({ where: { status: "PENDENTE" } }),
    prisma.justificativa.count({ where: { status: "PENDENTE" } }),
    prisma.mensagem.count({ where: { lidaEm: null, autor: { papel: "CLIENTE" } } }),
    prisma.ocorrenciaDisciplinar.count({ where: { status: "EM_ANALISE_CONSULTOR" } }),
    quantidadeParametrosPendentes(),
    prisma.notificacao.count({ where: { usuarioId: u.id, lidaEm: null } }),
  ]);
  return (
    <Casca
      titulo="Consultoria"
      usuario={u.nome}
      itens={[
        { href: "/consultor", rotulo: "Painel", icone: "🏠" },
        { href: "/consultor/avisos", rotulo: "Avisos", icone: "🔔", contador: avisos },
        { href: "/consultor/clientes", rotulo: "Clientes", icone: "👥" },
        { href: "/consultor/rotina", rotulo: "Rotina mensal", icone: "✅" },
        { href: "/consultor/agenda", rotulo: "Agenda e alertas", icone: "📅" },
        { href: "/consultor/calculadora", rotulo: "Calculadora", icone: "🧮" },
        { href: "/consultor/simuladores", rotulo: "Simuladores", icone: "📊" },
        { href: "/consultor/ponto", rotulo: "Ponto", icone: "⏱️", contador: ajustes + justificativas },
        { href: "/consultor/documentos", rotulo: "Documentos", icone: "📄" },
        { href: "/consultor/disciplinar", rotulo: "Gestão disciplinar", icone: "⚖️", contador: disciplinar },
        { href: "/consultor/diagnostico", rotulo: "Diagnóstico de riscos", icone: "🩺" },
        { href: "/consultor/financeiro", rotulo: "Financeiro", icone: "💰" },
        { href: "/consultor/captacao", rotulo: "Captação", icone: "🎯" },
        { href: "/consultor/mensagens", rotulo: "Mensagens", icone: "💬", contador: mensagens },
        { href: "/consultor/conhecimento", rotulo: "Base de conhecimento", icone: "📚" },
        { href: "/consultor/produtividade", rotulo: "Produtividade", icone: "⏳" },
        { href: "/consultor/atividades", rotulo: "Registro de atividades", icone: "🗂️" },
        { href: "/consultor/parametros", rotulo: "Parâmetros legais", icone: "📋", contador: parametrosPendentes },
        { href: "/consultor/configuracoes", rotulo: "Configurações", icone: "⚙️" },
        { href: "/consultor/lgpd", rotulo: "LGPD e backup", icone: "🔒" },
      ]}
    >
      {children}
    </Casca>
  );
}
