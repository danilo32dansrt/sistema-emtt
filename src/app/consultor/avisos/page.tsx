import { CentralAvisos } from "@/components/CentralAvisos";
import { exigirConsultor } from "@/lib/auth/sessao";

export const metadata = { title: "Avisos" };

export default async function AvisosConsultor() {
  const u = await exigirConsultor();
  return <CentralAvisos usuarioId={u.id} />;
}
