import { redirect } from "next/navigation";

/** Endereço impresso no carimbo e gravado no QR Code: /verificar/<código>. */
export default async function VerificarCodigo({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  redirect(`/verificar?codigo=${encodeURIComponent(codigo)}`);
}
