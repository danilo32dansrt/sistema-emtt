import { formatarMoeda, type ResultadoBeneficiosSociais } from "@/lib/calculos";
import { DocPdf } from "./base";

const SITUACAO = { integral: "Continua integral", protecao: "Regra de proteção", fora: "Sai do programa", nao_recebe: "Não recebe" } as const;

/** PDF de uma página para enviar à trabalhadora por WhatsApp. */
export async function pdfBeneficios(r: ResultadoBeneficiosSociais, nome: string, salario: number) {
  const doc = await DocPdf.criar({ titulo: "Simulação de benefícios", rodape: r.aviso });
  doc.titulo("CARTEIRA ASSINADA: O QUE MUDA PARA VOCÊ", 14);
  doc.paragrafo(`Simulação para ${nome || "a trabalhadora"}, com salário de ${formatarMoeda(salario)} na carteira.`);
  doc.tabela(
    ["", "Sem carteira (hoje)", "Com carteira"],
    [
      ["Renda da família (bruta)", formatarMoeda(r.semCarteira.rendaFamiliar), formatarMoeda(r.comCarteira.rendaFamiliar)],
      ["Renda por pessoa", formatarMoeda(r.semCarteira.rendaPerCapita), formatarMoeda(r.comCarteira.rendaPerCapita)],
      ["Bolsa Família", `${SITUACAO[r.semCarteira.bolsaFamilia.situacao]} (${formatarMoeda(r.semCarteira.bolsaFamilia.valorMensal)})`, `${SITUACAO[r.comCarteira.bolsaFamilia.situacao]} (${formatarMoeda(r.comCarteira.bolsaFamilia.valorMensal)})`],
      ["Você recebe por mês", formatarMoeda(r.semCarteira.rendaEmpregadaLiquida), `${formatarMoeda(r.comCarteira.rendaEmpregadaLiquida)} (já sem o INSS)`],
      ["Total da família por mês", formatarMoeda(r.semCarteira.totalMensalFamilia), formatarMoeda(r.comCarteira.totalMensalFamilia)],
    ],
    [150, 170, 175],
  );
  doc.paragrafo(r.comCarteira.bolsaFamilia.explicacao, { tamanho: 9 });
  for (const a of r.alertasBpc) doc.paragrafo(`Atenção (BPC): ${a}`, { tamanho: 9 });
  doc.subtitulo("Ganho estimado com a carteira (valores de hoje)");
  doc.campos([
    ["Em 12 meses", `${formatarMoeda(r.ganho12.diferenca)} a mais, além de ${formatarMoeda(r.ganho12.fgts)} guardados no FGTS`],
    ["Em 5 anos", `${formatarMoeda(r.ganho60.diferenca)} a mais, além de ${formatarMoeda(r.ganho60.fgts)} guardados no FGTS`],
  ]);
  doc.subtitulo("Seus direitos com o registro");
  for (const d of r.direitos) doc.paragrafo(`• ${d.titulo}: ${d.texto}`, { tamanho: 9, espaco: 2 });
  doc.subtitulo("Seus deveres");
  for (const d of r.deveres) doc.paragrafo(`• ${d}`, { tamanho: 9, espaco: 2 });
  doc.espaco(6).paragrafo(r.aviso, { negrito: true });
  doc.paragrafo("Informar toda a renda no CadÚnico é obrigatório e protege a família: quem sai do Bolsa Família por aumento de renda pode voltar com prioridade se a renda cair.", { tamanho: 8 });
  return doc.salvar();
}
