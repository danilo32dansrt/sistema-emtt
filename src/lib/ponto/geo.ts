/**
 * Local de trabalho pelo GPS: o patrão marca o centro da casa e a empregada só registra o ponto dentro do raio.
 * O GPS do celular erra alguns metros (mais dentro de casa); por isso soma-se ao raio a precisão informada pelo
 * aparelho, limitada a TOLERANCIA_MAX_METROS para não aceitar sinal muito ruim.
 */

export const TOLERANCIA_MAX_METROS = 30;
export const RAIOS_PERMITIDOS = [10, 20, 30, 50, 100] as const;

export interface Ponto {
  latitude: number;
  longitude: number;
}

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distanciaMetros(a: Ponto, b: Ponto): number {
  const r = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export type SituacaoLocal = "SEM_LOCAL_CADASTRADO" | "SEM_GPS" | "DENTRO" | "FORA";

/** A marcação foi feita dentro da casa? */
export function avaliarLocal(pos: (Ponto & { precisao?: number | null }) | null, casa: (Ponto & { raio: number }) | null): { situacao: SituacaoLocal; distancia: number | null } {
  if (!casa) return { situacao: "SEM_LOCAL_CADASTRADO", distancia: null };
  if (!pos) return { situacao: "SEM_GPS", distancia: null };
  const distancia = Math.round(distanciaMetros(pos, casa));
  const tolerancia = Math.min(Math.max(pos.precisao ?? 0, 0), TOLERANCIA_MAX_METROS);
  return { situacao: distancia <= casa.raio + tolerancia ? "DENTRO" : "FORA", distancia };
}
