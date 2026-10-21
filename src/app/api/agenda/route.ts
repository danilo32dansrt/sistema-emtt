import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth/sessao";
import { addDias, hojeBrasil } from "@/lib/calculos";
import { agendaDoBanco } from "@/lib/servicos/agenda";

function escapar(t: string) {
  return t.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Exporta a agenda em iCalendar para o calendário do celular (com lembrete 1 dia antes). */
export async function GET() {
  const u = await usuarioAtual();
  if (!u || u.papel === "EMPREGADO") return new NextResponse("Não autorizado", { status: 401 });
  const hoje = hojeBrasil();
  const eventos = await agendaDoBanco({ de: hoje, ate: addDias(hoje, 365), clienteId: u.papel === "CLIENTE" ? u.clienteId! : undefined, hoje });
  const agora = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const linhas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//eSocial Domestico//Agenda//PT-BR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:eSocial Doméstico"];
  for (const e of eventos) {
    const d = e.data.toISOString().slice(0, 10).replace(/-/g, "");
    const fim = addDias(e.data, 1).toISOString().slice(0, 10).replace(/-/g, "");
    linhas.push("BEGIN:VEVENT", `UID:${e.chave}@esocial-domestico`, `DTSTAMP:${agora}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${fim}`, `SUMMARY:${escapar(e.titulo)}`, `DESCRIPTION:${escapar(e.descricao)}`, "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", `DESCRIPTION:${escapar(e.titulo)}`, "END:VALARM", "END:VEVENT");
  }
  linhas.push("END:VCALENDAR");
  return new NextResponse(linhas.join("\r\n"), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="agenda-esocial.ics"' } });
}
