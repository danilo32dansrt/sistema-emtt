import { ListaAgenda } from "@/components/ListaAgenda";
import { Titulo } from "@/components/ui";
import { exigirCliente } from "@/lib/auth/sessao";
import { addDias, hojeBrasil } from "@/lib/calculos";
import { agendaDoBanco } from "@/lib/servicos/agenda";

export const metadata = { title: "Calendário" };

export default async function Calendario() {
  const u = await exigirCliente();
  const hoje = hojeBrasil();
  const eventos = await agendaDoBanco({ clienteId: u.clienteId, de: hoje, ate: addDias(hoje, 365), hoje });
  return (
    <>
      <Titulo subtitulo="Todos os vencimentos e prazos dos próximos 12 meses." acoes={<a className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-4 font-semibold" href="/api/agenda">📲 Adicionar ao meu calendário</a>}>Calendário do empregador</Titulo>
      <ListaAgenda eventos={eventos} hoje={hoje} />
    </>
  );
}
