import { CentralAvisos } from "@/components/CentralAvisos";
import { exigirCliente } from "@/lib/auth/sessao";

export const metadata = { title: "Avisos" };

export default async function AvisosCliente() {
  const u = await exigirCliente();
  return <CentralAvisos usuarioId={u.id} />;
}
