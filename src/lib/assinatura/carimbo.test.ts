import { describe, expect, it } from "vitest";
import { CARIMBO, dataHoraCarimbo, emPontos, limitarPosicao, linhasCarimbo, papelDaLinha, posicaoPadrao, posicoesDosCarimbos, type LocalAssinatura } from "./carimbo";

const A4 = { largura: 595.28, altura: 841.89 };

describe("carimbo de assinatura", () => {
  it("mantém o carimbo inteiro dentro da página", () => {
    const p = limitarPosicao({ pagina: 5, x: 0.99, y: -1 }, [A4, A4]);
    expect(p.pagina).toBe(1);
    expect(p.y).toBe(0);
    expect(p.x).toBeCloseTo(1 - CARIMBO.largura / A4.largura, 6);
    expect(limitarPosicao({ pagina: 0, x: Number.NaN, y: 0.5 }, [A4]).x).toBe(0);
  });

  it("converte para pontos do PDF (origem embaixo à esquerda)", () => {
    expect(emPontos({ pagina: 0, x: 0, y: 0 }, A4)).toEqual({ x: 0, y: A4.altura - CARIMBO.altura });
    const meio = emPontos({ pagina: 0, x: 0.5, y: 0.5 }, A4);
    expect(meio.x).toBeCloseTo(297.64, 2);
    expect(meio.y).toBeCloseTo(A4.altura / 2 - CARIMBO.altura, 2);
  });

  it("reconhece quem assina pela legenda da linha (empregador antes de empregado)", () => {
    expect(papelDaLinha("Empregador(a)")).toBe("CLIENTE");
    expect(papelDaLinha("Ciente — Empregador(a)")).toBe("CLIENTE");
    expect(papelDaLinha("Ciente — Empregado(a)")).toBe("EMPREGADO");
    expect(papelDaLinha("Empregado(a) — CPF 390.533.447-05")).toBe("EMPREGADO");
    expect(papelDaLinha("Contratante")).toBe("CLIENTE");
    expect(papelDaLinha("Contratada")).toBe("CONSULTOR");
    expect(papelDaLinha("Nome e CPF")).toBeNull();
    expect(papelDaLinha("Testemunha 1")).toBeNull();
  });

  it("coloca o carimbo logo acima da linha de assinatura do papel", () => {
    const locais: LocalAssinatura[] = [
      { pagina: 1, x: 60, y: 200, largura: 227, papel: "Empregador(a)" },
      { pagina: 1, x: 307, y: 200, largura: 227, papel: "Empregado(a)" },
    ];
    const p = posicaoPadrao("EMPREGADO", 0, locais, [A4, A4])!;
    expect(p.pagina).toBe(1);
    const pt = emPontos(p, A4);
    expect(pt.y).toBeCloseTo(202, 4);
    expect(pt.x).toBeCloseTo(307 + (227 - CARIMBO.largura) / 2, 4);
    expect(posicaoPadrao("CONSULTOR", 0, locais, [A4, A4])).toBeNull();
    // segundo signatário do mesmo papel fica empilhado acima, sem sobrepor
    const p2 = emPontos(posicaoPadrao("CLIENTE", 1, locais, [A4, A4])!, A4);
    expect(p2.y).toBeCloseTo(202 + CARIMBO.altura + 4, 4);
  });

  it("escreve data e hora de Brasília e as linhas do carimbo", () => {
    expect(dataHoraCarimbo(new Date("2026-10-22T17:05:09Z"))).toBe("22/10/2026 14:05:09-0300");
    const l = linhasCarimbo({ nome: "Suely Exemplo", data: new Date("2026-10-22T17:05:09Z"), codigo: "abc123", endereco: "https://sistema.exemplo.com.br/" });
    expect(l).toEqual([
      "Documento assinado digitalmente",
      "SUELY EXEMPLO",
      "Data: 22/10/2026 14:05:09-0300",
      "art. 4º, I, da Lei nº 14.063/2020 e art. 10, § 2º, da MP nº 2.200-2/2001, com login e senha do signatário.",
      "Verifique em https://sistema.exemplo.com.br/verificar/abc123",
    ]);
    expect(linhasCarimbo({ nome: "Maria", codigo: "x" })[0]).toBe("Assinatura digital (prévia do lugar)");
  });
});

describe("posições de vários carimbos", () => {
  it("usa a posição escolhida e, sem escolha, a linha do papel", () => {
    const locais: LocalAssinatura[] = [{ pagina: 0, x: 60, y: 300, largura: 227, papel: "Empregador(a)" }];
    const r = posicoesDosCarimbos(
      [{ usuarioId: "a", papel: "CLIENTE" }, { usuarioId: "b", papel: "EMPREGADO" }, { usuarioId: "c", papel: "CLIENTE" }],
      { c: { pagina: 9, x: 2, y: 0.1 } },
      locais,
      [A4],
    );
    expect(emPontos(r.a!, A4).y).toBeCloseTo(302, 4);
    expect(r.b).toBeNull();
    expect(r.c).toEqual({ pagina: 0, x: 1 - CARIMBO.largura / A4.largura, y: 0.1 });
  });
});
