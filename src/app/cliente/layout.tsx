import { Casca } from "@/components/Casca";
import { exigirCliente } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";

export default async function LayoutCliente({ children }: { children: React.ReactNode }) {
  const u = await exigirCliente();
  const [assinar, ponto, mensagens] = await Promise.all([
    prisma.documento.count({ where: { clienteId: u.clienteId, exigeAssinaturaCliente: true, visivelCliente: true, assinaturas: { none: { papel: "CLIENTE" } } } }),
    prisma.ajustePonto.count({ where: { status: "PENDENTE", empregado: { clienteId: u.clienteId } } }).then(async (n) => n + (await prisma.justificativa.count({ where: { status: "PENDENTE", empregado: { clienteId: u.clienteId } } }))),
    prisma.mensagem.count({ where: { clienteId: u.clienteId, lidaEm: null, autor: { papel: "CONSULTOR" } } }),
  ]);
  return (
    <Casca
      titulo="Portal do empregador"
      usuario={u.nome}
      itens={[
        { href: "/cliente", rotulo: "Início", icone: "🏠" },
        { href: "/cliente/informar", rotulo: "Informar o mês", icone: "✍️" },
        { href: "/cliente/dae", rotulo: "DAE e pagamentos", icone: "🧾" },
        { href: "/cliente/documentos", rotulo: "Documentos", icone: "📄", contador: assinar },
        { href: "/cliente/ponto", rotulo: "Ponto", icone: "⏱️", contador: ponto },
        { href: "/cliente/disciplinar", rotulo: "Gestão disciplinar", icone: "⚖️" },
        { href: "/cliente/simuladores", rotulo: "Simuladores", icone: "📊" },
        { href: "/cliente/custos", rotulo: "Painel de custos", icone: "💹" },
        { href: "/cliente/calendario", rotulo: "Calendário", icone: "📅" },
        { href: "/cliente/mensagens", rotulo: "Falar com o consultor", icone: "💬", contador: mensagens },
        { href: "/cliente/ajuda", rotulo: "Dúvidas frequentes", icone: "❓" },
        { href: "/cliente/mensalidade", rotulo: "Mensalidade", icone: "💳" },
        { href: "/cliente/conta", rotulo: "Minha conta", icone: "👤" },
      ]}
    >
      {children}
    </Casca>
  );
}
