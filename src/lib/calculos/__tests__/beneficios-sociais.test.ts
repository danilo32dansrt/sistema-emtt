import { describe, expect, it } from "vitest";
import { data, estimarBolsaFamilia, PARAMETROS_PADRAO, parametrosSociais, simularBeneficiosSociais, tabelaNaData } from "..";

const ref = data(2026, 10, 1);
const params = parametrosSociais(PARAMETROS_PADRAO, ref);
const tabela = tabelaNaData(PARAMETROS_PADRAO, ref);
const familia = [
  { nome: "Maria", idade: 40, renda: 600, ehEmpregada: true },
  { nome: "João", idade: 3, renda: 0 },
  { nome: "Ana", idade: 10, renda: 0 },
  { nome: "Dona Rosa", idade: 66, renda: 0 },
];

describe("simulador de benefícios", () => {
  it("estima o Bolsa Família pela composição da família", () => {
    // max(4 × 142 = 568, 600) + 150 (0–6 anos) + 50 (7–17 anos)
    expect(estimarBolsaFamilia(familia, params).valor).toBe(800);
  });

  it("salário de meio período mantém o Bolsa Família integral", () => {
    const r = simularBeneficiosSociais({ pessoas: familia, salarioProposto: 810.5, recebeBolsaFamilia: true, params, tabela });
    expect(r.semCarteira.rendaPerCapita).toBe(150);
    expect(r.comCarteira.rendaPerCapita).toBe(202.63);
    expect(r.comCarteira.bolsaFamilia.situacao).toBe("integral");
    expect(r.liquido).toBe(749.72);
  });

  it("salário mínimo integral entra na regra de proteção (metade por 12 meses, Portaria MDS 1.084/2025)", () => {
    const r = simularBeneficiosSociais({ pessoas: familia, salarioProposto: 1621, recebeBolsaFamilia: true, params, tabela });
    expect(r.comCarteira.rendaPerCapita).toBe(405.25);
    expect(r.comCarteira.bolsaFamilia.situacao).toBe("protecao");
    expect(r.comCarteira.bolsaFamilia.valorMensal).toBe(400);
    expect(r.comCarteira.bolsaFamilia.meses).toBe(12);
    expect(r.notasBolsa.join(" ")).toMatch(/24 meses/);
    // 12 meses: sem = 12 × (600 + 800); com = 12 × (1499,43 + 400) + 13º líquido + 1/3 de férias
    expect(r.ganho12.sem).toBe(16800);
    expect(r.ganho12.com).toBeCloseTo(12 * (1621 - 121.57 + 400) + (1621 - 121.57) + 540.33, 1);
    expect(r.ganho60.diferenca).toBeGreaterThan(r.ganho12.diferenca);
  });

  it("renda por pessoa acima de R$ 706 sai do programa", () => {
    const r = simularBeneficiosSociais({ pessoas: familia.slice(0, 2), salarioProposto: 1621, recebeBolsaFamilia: true, valorBolsaFamilia: 750, params, tabela });
    expect(r.comCarteira.rendaPerCapita).toBe(810.5);
    expect(r.comCarteira.bolsaFamilia.situacao).toBe("fora");
  });

  it("renda alta sai do programa", () => {
    const r = simularBeneficiosSociais({ pessoas: familia.slice(0, 2), salarioProposto: 2500, recebeBolsaFamilia: true, valorBolsaFamilia: 750, params, tabela });
    expect(r.comCarteira.bolsaFamilia.situacao).toBe("fora");
    expect(r.comCarteira.bolsaFamilia.explicacao).toMatch(/retorno garantido/);
  });

  it("alerta sobre BPC e nunca sugere omitir renda", () => {
    const comBpc = familia.map((p) => (p.nome === "Dona Rosa" ? { ...p, recebeBpc: true, valorBpc: 1621 } : p));
    const r = simularBeneficiosSociais({ pessoas: comBpc, salarioProposto: 1621, recebeBolsaFamilia: true, params, tabela });
    expect(r.alertasBpc.length).toBe(1);
    expect(r.alertasBpc[0]).toMatch(/CRAS|INSS/);
    expect(r.deveres.join(" ")).toMatch(/Atualizar o CadÚnico/);
    expect(JSON.stringify(r)).not.toMatch(/omitir|esconder/i);
    expect(r.aviso).toBe("Simulação estimada. Confirme no CRAS ou no app Bolsa Família.");
  });
});
