import { redirect } from "next/navigation";

/** Endereço impresso no carimbo e gravado no QR Code (sem domínio próprio de verificação): /verificar/<código>. */
export default async function VerificarCodigo({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  redirect(`/verificar?codigo=${encodeURIComponent(codigo)}`);
}
