import "server-only";

/** Envia e-mail pelo Resend, se RESEND_API_KEY estiver configurada. Sem chave, apenas registra no log. */
export async function enviarEmail(para: string, assunto: string, html: string): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) {
    console.info(`[e-mail não enviado: configure RESEND_API_KEY] ${para} — ${assunto}`);
    return false;
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_REMETENTE ?? "Consultoria <onboarding@resend.dev>", to: [para], subject: assunto, html }),
  });
  if (!resp.ok) console.error("Falha ao enviar e-mail", resp.status, await resp.text());
  return resp.ok;
}
