import { CentralAvisos } from "@/components/CentralAvisos";
import { exigirEmpregado } from "@/lib/auth/sessao";

export const metadata = { title: "Avisos" };

export default async function AvisosEmpregado() {
  const u = await exigirEmpregado();
  return <CentralAvisos usuarioId={u.id} />;
}
