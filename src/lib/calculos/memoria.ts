/**
 * Memória de cálculo: cada cálculo devolve uma lista de linhas legíveis
 * explicando a fórmula usada e o resultado, para conferência pelo consultor.
 */
export interface LinhaMemoria {
  descricao: string;
  formula?: string;
  valor?: number;
  /** "moeda" (padrão), "numero", "dias", "horas", "texto" */
  tipo?: "moeda" | "numero" | "dias" | "horas" | "percentual" | "texto";
  destaque?: boolean;
}

export class Memoria {
  readonly linhas: LinhaMemoria[] = [];

  add(descricao: string, valor?: number, formula?: string, tipo: LinhaMemoria["tipo"] = "moeda"): this {
    this.linhas.push({ descricao, valor, formula, tipo });
    return this;
  }

  destaque(descricao: string, valor: number, formula?: string): this {
    this.linhas.push({ descricao, valor, formula, tipo: "moeda", destaque: true });
    return this;
  }

  nota(texto: string): this {
    this.linhas.push({ descricao: texto, tipo: "texto" });
    return this;
  }

  juntar(outra: Memoria | LinhaMemoria[], prefixo?: string): this {
    const linhas = Array.isArray(outra) ? outra : outra.linhas;
    for (const l of linhas) this.linhas.push(prefixo ? { ...l, descricao: `${prefixo}: ${l.descricao}` } : l);
    return this;
  }
}

export const AVISO_ESTIMATIVA =
  "Os cálculos são estimativas de apoio; os valores oficiais são os gerados pelo eSocial, e questões judiciais devem ser encaminhadas a um advogado.";
