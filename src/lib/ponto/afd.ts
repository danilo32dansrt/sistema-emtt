import { crc16 } from "@/lib/pix";
import { somenteDigitos } from "@/lib/calculos";
import { OFFSET_BRASILIA_MIN } from "@/lib/calculos/ponto";

/**
 * Geração simplificada do AFD (Arquivo-Fonte de Dados) e do AEJ (Arquivo
 * Eletrônico de Jornada) inspirada no leiaute da Portaria MTP 671/2021, Anexo V.
 *
 * ATENÇÃO: para comercializar o sistema como REP-P é obrigatório registro do
 * programa no INPI, atestado técnico e termo de responsabilidade, além de
 * validar os arquivos com o leiaute oficial vigente. Este gerador serve para
 * guarda e conferência interna dos registros.
 */

function dataHoraIso(d: Date): string {
  const local = new Date(d.getTime() + OFFSET_BRASILIA_MIN * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}T${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:00-0300`;
}

function linhaComCrc(linha: string): string {
  return linha + crc16(linha);
}

export interface DadosAfd {
  empregador: { cpf: string; nome: string; local: string };
  identificadorRep: string;
  inicio: Date;
  fim: Date;
  marcacoes: { nsr: number; dataHora: Date; recebidoEm: Date; cpf: string; origem: string; hash: string }[];
}

export function gerarAfd(d: DadosAfd): string {
  const linhas: string[] = [];
  const cpfEmp = somenteDigitos(d.empregador.cpf).padStart(14, "0");
  const ini = dataHoraIso(d.inicio).slice(0, 10);
  const fim = dataHoraIso(d.fim).slice(0, 10);
  // Registro tipo 1 — cabeçalho
  linhas.push(
    linhaComCrc(
      "000000000" + "1" + "2" + cpfEmp + "".padEnd(14, " ") + d.empregador.nome.slice(0, 150).padEnd(150, " ") +
      d.identificadorRep.padEnd(17, "0").slice(0, 17) + ini + fim + dataHoraIso(new Date()) + "003" + "1" + "".padEnd(14, " "),
    ),
  );
  // Registro tipo 7 — marcação de ponto para REP-P
  for (const m of d.marcacoes) {
    linhas.push(
      String(m.nsr).padStart(9, "0") + "7" + dataHoraIso(m.dataHora) + somenteDigitos(m.cpf).padStart(12, "0") +
      dataHoraIso(m.recebidoEm) + "01" + (m.origem === "ONLINE" ? "0" : "1") + m.hash.slice(0, 64),
    );
  }
  // Registro tipo 9 — trailer
  linhas.push("999999999" + "0".padStart(9, "0") + "0".padStart(9, "0") + "0".padStart(9, "0") + "0".padStart(9, "0") + String(d.marcacoes.length).padStart(9, "0") + "9");
  linhas.push("ASSINATURA_DIGITAL_PENDENTE");
  return linhas.join("\r\n") + "\r\n";
}

export interface DadosAej {
  empregador: { cpf: string; nome: string };
  inicio: Date;
  fim: Date;
  empregados: { cpf: string; nome: string; jornadas: { data: Date; marcacoes: Date[] }[] }[];
}

/** AEJ simplificado: cabeçalho, vínculos e marcações por dia (separador "|"). */
export function gerarAej(d: DadosAej): string {
  const linhas: string[] = [];
  linhas.push(["01", "2", somenteDigitos(d.empregador.cpf), d.empregador.nome, dataHoraIso(d.inicio).slice(0, 10), dataHoraIso(d.fim).slice(0, 10), dataHoraIso(new Date())].join("|"));
  d.empregados.forEach((e, i) => linhas.push(["03", String(i + 1), somenteDigitos(e.cpf), e.nome].join("|")));
  d.empregados.forEach((e, i) => {
    for (const j of e.jornadas) {
      for (const m of j.marcacoes) linhas.push(["05", String(i + 1), dataHoraIso(m), "E"].join("|"));
    }
  });
  linhas.push(["99", String(linhas.length + 1)].join("|"));
  return linhas.join("\r\n") + "\r\n";
}
