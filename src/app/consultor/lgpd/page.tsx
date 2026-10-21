/* eslint-disable @next/next/no-html-link-for-pages -- são downloads de arquivos (rotas de API), não páginas */
import { Formulario } from "@/components/Formulario";
import { Aviso, Campo, Cartao, Selecao, Titulo } from "@/components/ui";
import { prisma } from "@/lib/db";
import { excluirDadosCliente } from "./acoes";

export const metadata = { title: "LGPD e backup" };

export default async function Lgpd() {
  const clientes = await prisma.cliente.findMany({ where: { anonimizadoEm: null }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const link = "inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 font-semibold hover:bg-slate-50";
  return (
    <>
      <Titulo subtitulo="Proteção de dados pessoais (Lei 13.709/2018), cópias de segurança e exportação.">LGPD e backup</Titulo>
      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao titulo="Exportar em planilha">
          <div className="grid grid-cols-2 gap-2">
            <a className={link} href="/api/exportar/clientes">Clientes</a>
            <a className={link} href="/api/exportar/empregados">Empregados</a>
            <a className={link} href="/api/exportar/rotina">Rotina mensal</a>
            <a className={link} href="/api/exportar/financeiro">Financeiro</a>
            <a className={link} href="/api/exportar/marcacoes">Marcações de ponto</a>
          </div>
        </Cartao>
        <Cartao titulo="Backup completo">
          <p className="mb-3 text-sm text-slate-600">Arquivo JSON com todos os dados (sem senhas e sem o conteúdo dos arquivos). Guarde em local seguro. No Supabase, ative também os backups automáticos do banco.</p>
          <a className={link} href="/api/backup">Baixar backup agora</a>
        </Cartao>
        <Cartao titulo="Como o sistema protege os dados">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Senhas guardadas com criptografia (bcrypt), nunca em texto.</li>
            <li>Cada cliente e empregado só acessa os próprios dados; o banco bloqueia a API pública (RLS).</li>
            <li>CPF mascarado nas listagens.</li>
            <li>Registro de acessos, logins e de cada documento aberto (Registro de atividades).</li>
            <li>Selfie e localização coletadas só no momento da marcação, com aviso e ciência do empregado.</li>
            <li>Bloqueio de login após 5 tentativas erradas.</li>
          </ul>
        </Cartao>
        <Cartao titulo="Exclusão de dados a pedido">
          <Aviso tipo="critico">Ação irreversível. Os dados pessoais do cliente e dos empregados serão anonimizados e documentos, arquivos, mensagens e acessos apagados. Registros de ponto ficam guardados sem identificação (obrigação legal de 5 anos).</Aviso>
          <Formulario acao={excluirDadosCliente} textoBotao="Excluir dados" variante="perigo" className="mt-3" confirmar="Tem certeza? Esta ação não pode ser desfeita.">
            <Selecao rotulo="Cliente" name="clienteId" opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
            <Campo rotulo='Digite "EXCLUIR" para confirmar' name="confirmacao" required />
          </Formulario>
        </Cartao>
      </div>
    </>
  );
}
