import { describe, expect, it } from "vitest";
import { avaliarLocal, distanciaMetros } from "./geo";

const casa = { latitude: -23.55052, longitude: -46.633308, raio: 10 };
// ~0,00009° de latitude ≈ 10 m
const aMetros = (m: number) => ({ latitude: casa.latitude + (m / 111_195), longitude: casa.longitude });

describe("local da casa pelo GPS", () => {
  it("calcula a distância em metros", () => {
    expect(Math.round(distanciaMetros(casa, aMetros(10)))).toBe(10);
    expect(Math.round(distanciaMetros(casa, aMetros(100)))).toBe(100);
  });

  it("dentro do raio de 10 m (somando a precisão do GPS, até 30 m)", () => {
    expect(avaliarLocal({ ...aMetros(8), precisao: 5 }, casa).situacao).toBe("DENTRO");
    expect(avaliarLocal({ ...aMetros(25), precisao: 20 }, casa).situacao).toBe("DENTRO");
    expect(avaliarLocal({ ...aMetros(25), precisao: 3 }, casa)).toEqual({ situacao: "FORA", distancia: 25 });
    // Sinal muito ruim (precisão de 200 m) não libera a marcação de longe
    expect(avaliarLocal({ ...aMetros(150), precisao: 200 }, casa).situacao).toBe("FORA");
  });

  it("sem GPS ou sem a casa marcada", () => {
    expect(avaliarLocal(null, casa).situacao).toBe("SEM_GPS");
    expect(avaliarLocal(aMetros(5), null).situacao).toBe("SEM_LOCAL_CADASTRADO");
  });
});
