import { describe, expect, it } from "vitest";
import { cobrancaAtiva, formaRecebimento, interpretarSituacao, lerPem, montarPedidoCobranca, seuNumero, type DadosPedido } from "./regras";

const base: DadosPedido = {
  mensalidade: { id: "clx9abcdef12345678", ano: 2026, mes: 11, valor: 150, vencimento: new Date(Date.UTC(2026, 10, 10)) },
  cliente: { nome: "Suely Exemplo", cpf: "529.982.247-25", email: "suely@exemplo.com.br", telefone: "(11) 98765-4321", endereco: "Rua das Flores, 100", cidade: "São Paulo", uf: "sp", cep: "01001-000" },
  multaPercentual: 2,
  jurosMensalPercentual: 1,
  diasBaixa: 30,
  nomeConsultoria: "Consultoria eSocial Doméstico",
  hoje: new Date(Date.UTC(2026, 10, 1)),
};

describe("Cobrança Inter — pedido de emissão", () => {
  it("monta boleto com Pix, multa, juros e dados do pagador", () => {
    const r = montarPedidoCobranca(base);
    if (!r.ok) throw new Error("deveria montar");
    expect(r.pedido).toMatchObject({
      valorNominal: 150,
      dataVencimento: "2026-11-10",
      numDiasAgenda: 30,
      formasRecebimento: ["BOLETO", "PIX"],
      multa: { codigo: "PERCENTUAL", taxa: 2 },
      mora: { codigo: "TAXAMENSAL", taxa: 1 },
      pagador: { cpfCnpj: "52998224725", tipoPessoa: "FISICA", uf: "SP", cep: "01001000", ddd: "11", telefone: "987654321", email: "suely@exemplo.com.br" },
    });
    expect(r.pedido.seuNumero.length).toBeLessThanOrEqual(15);
    expect(r.pedido.mensagem.linha1).toBe("Mensalidade 11/2026 - Consultoria eSocial Doméstico");
  });

  it("aponta o que falta no cadastro do cliente", () => {
    const r = montarPedidoCobranca({ ...base, cliente: { nome: "Sem Endereço", cpf: "123", uf: "XX" } });
    expect(r).toEqual({ ok: false, faltando: ["CPF/CNPJ", "endereço", "cidade", "UF", "CEP"] });
  });

  it("CNPJ vira pessoa jurídica; sem multa/juros não envia os campos", () => {
    const r = montarPedidoCobranca({ ...base, cliente: { ...base.cliente, cpf: "11.222.333/0001-81" }, multaPercentual: 0, jurosMensalPercentual: 0 });
    if (!r.ok) throw new Error("deveria montar");
    expect(r.pedido.pagador.tipoPessoa).toBe("JURIDICA");
    expect(r.pedido.multa).toBeUndefined();
    expect(r.pedido.mora).toBeUndefined();
  });

  it("mensalidade vencida é emitida com vencimento hoje e prazo de baixa limitado a 60 dias", () => {
    const r = montarPedidoCobranca({ ...base, hoje: new Date(Date.UTC(2026, 10, 20)), diasBaixa: 90 });
    if (!r.ok) throw new Error("deveria montar");
    expect(r.pedido.dataVencimento).toBe("2026-11-20");
    expect(r.pedido.numDiasAgenda).toBe(60);
  });

  it("seu número é único por mensalidade e cabe em 15 caracteres", () => {
    expect(seuNumero({ id: "clx9abcdef12345678", ano: 2026, mes: 3 })).toBe("M20260312345678");
  });
});

describe("Cobrança Inter — situação", () => {
  it("traduz a situação do banco", () => {
    expect(interpretarSituacao("RECEBIDO")).toBe("PAGO");
    expect(interpretarSituacao("MARCADO_RECEBIDO")).toBe("PAGO");
    expect(interpretarSituacao("A_RECEBER")).toBe("ABERTO");
    expect(interpretarSituacao("ATRASADO")).toBe("ABERTO");
    expect(interpretarSituacao("EXPIRADO")).toBe("CANCELADO");
    expect(interpretarSituacao("FALHA_EMISSAO")).toBe("FALHA");
    expect(interpretarSituacao("EM_PROCESSAMENTO")).toBe("PROCESSANDO");
    expect(cobrancaAtiva("ATRASADO")).toBe(true);
    expect(cobrancaAtiva("RECEBIDO")).toBe(false);
    expect(formaRecebimento("PIX")).toBe("Pix (Inter)");
  });

  it("lê certificado em PEM ou base64", () => {
    const pem = "-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----";
    expect(lerPem(pem.replace(/\n/g, "\\n"))).toBe(pem);
    expect(lerPem(Buffer.from(pem).toString("base64"))).toBe(pem);
    expect(lerPem("")).toBeNull();
    expect(lerPem("bGl4bw==")).toBeNull();
  });
});
