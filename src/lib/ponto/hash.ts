import { createHash } from "node:crypto";

/** Conteúdo encadeado que gera o hash SHA-256 de cada marcação (qualquer alteração quebra a cadeia). */
export function hashMarcacao(m: {
  hashAnterior: string | null | undefined;
  empregadoId: string;
  cpf: string;
  tipo: string;
  dataHora: Date;
  latitude?: number | null;
  longitude?: number | null;
  selfieArquivoId?: string | null;
  idLocal: string;
}): string {
  const conteudo = [m.hashAnterior ?? "", m.empregadoId, m.cpf, m.tipo, m.dataHora.toISOString(), m.latitude ?? "", m.longitude ?? "", m.selfieArquivoId ?? "", m.idLocal].join("|");
  return createHash("sha256").update(conteudo).digest("hex");
}
