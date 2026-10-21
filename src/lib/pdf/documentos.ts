import type { Cliente, Configuracao, Empregado } from "@prisma/client";
import {
  DIAS_SEMANA, NOMES_DIAS_SEMANA, NOMES_REGIME, diasDoMes, formatarCpf, formatarData, formatarMoeda, formatarNumero, minutosParaHora, nomeMes,
  type LinhaMemoria, type ResultadoDia,
} from "@/lib/calculos";
import { horariosDoEmpregado, jornadaDoEmpregado, num } from "@/lib/conversao";
import { DocPdf } from "./base";

export interface Partes {
  config: Configuracao;
  cliente: Cliente;
  empregado?: Empregado | null;
}

const AVISO = "Documento gerado pelo sistema de gestão eSocial Doméstico. Valores são estimativas de apoio; os oficiais são os do eSocial.";

function endereco(c: Cliente) {
  return [c.endereco, c.cidade, c.uf, c.cep].filter(Boolean).join(", ") || "endereço do empregador";
}

function cidadeData(p: Partes, data = new Date()) {
  return `${p.cliente.cidade || p.config.cidade || "________"}, ${data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" })}.`;
}

function descreverJornada(e: Empregado) {
  const j = jornadaDoEmpregado(e);
  const h = horariosDoEmpregado(e) ?? {};
  return DIAS_SEMANA.filter((d) => j[d])
    .map((d) => `${NOMES_DIAS_SEMANA[d]}: ${String(j[d]).replace(".", ",")}h${h[d] ? ` (${h[d]!.entrada} às ${h[d]!.saida})` : ""}`)
    .join("; ");
}

function qualificacao(p: Partes) {
  const e = p.empregado!;
  return `EMPREGADOR(A): ${p.cliente.nome}, CPF ${formatarCpf(p.cliente.cpf)}, residente em ${endereco(p.cliente)}.\nEMPREGADO(A): ${e.nome}, CPF ${formatarCpf(e.cpf)}${e.nascimento ? `, nascido(a) em ${formatarData(e.nascimento)}` : ""}.`;
}

export async function contratoTrabalho(p: Partes) {
  const e = p.empregado!;
  const exp = e.diasExperiencia;
  const doc = await DocPdf.criar({ titulo: "Contrato de Trabalho Doméstico", rodape: AVISO });
  doc.titulo("CONTRATO DE TRABALHO DOMÉSTICO").paragrafo(exp ? `Por prazo determinado — experiência de ${exp} dias` : "Por prazo indeterminado", { negrito: true });
  doc.paragrafo(qualificacao(p));
  doc.paragrafo("As partes acima celebram o presente contrato de trabalho doméstico, regido pela Lei Complementar nº 150/2015 e, subsidiariamente, pela CLT, nas seguintes condições:");
  const clausulas = [
    `FUNÇÃO — O(A) EMPREGADO(A) exercerá a função de ${e.funcao} (CBO ${e.cbo}), prestando serviços de natureza contínua, no âmbito residencial do(a) EMPREGADOR(A), sem finalidade lucrativa.`,
    `INÍCIO — O contrato tem início em ${formatarData(e.admissao)}${exp ? `, a título de experiência pelo prazo de ${exp} dias, podendo ser prorrogado uma única vez desde que a soma não ultrapasse 90 dias (LC 150, art. 5º). Se o(a) empregado(a) continuar trabalhando após o término, o contrato passa a vigorar por prazo indeterminado` : ""}.`,
    `REMUNERAÇÃO — Salário mensal de ${formatarMoeda(num(e.salario))}, pago até o 5º dia útil do mês seguinte, mediante recibo.`,
    `JORNADA — Regime ${NOMES_REGIME[e.regime]}, com ${formatarNumero(num(e.horasSemanais))} horas semanais, assim distribuídas: ${descreverJornada(e)}. ${e.regime === "PARCIAL" ? "Em tempo parcial, a jornada não excederá 25 horas semanais nem 6 horas diárias, admitida 1 hora extra diária mediante acordo escrito (LC 150, art. 3º)." : e.regime === "DOZE_X_TRINTA_SEIS" ? "Escala de 12 horas de trabalho por 36 de descanso, conforme acordo escrito (LC 150, art. 10), considerando-se compensados os feriados e o descanso semanal." : "A jornada não excederá 8 horas diárias e 44 semanais (LC 150, art. 2º)."}`,
    `INTERVALO — Para jornadas acima de 6 horas será concedido intervalo de no mínimo 1 hora e no máximo 2 horas${e.acordoIntervaloReduzido ? ", reduzido para 30 minutos conforme acordo escrito" : ""} (LC 150, art. 13). Entre duas jornadas haverá descanso mínimo de 11 horas consecutivas (art. 15).`,
    "HORAS EXTRAS — As horas excedentes serão remuneradas com adicional mínimo de 50%, e o trabalho em domingos e feriados não compensados, em dobro. Havendo acordo escrito de compensação, observar-se-á o art. 2º, §§ 4º a 6º, da LC 150.",
    "TRABALHO NOTURNO — O trabalho entre 22h e 5h terá hora de 52 minutos e 30 segundos e adicional mínimo de 20% (LC 150, art. 14).",
    "DESCANSO — O(A) EMPREGADO(A) terá descanso semanal remunerado de 24 horas consecutivas, preferencialmente aos domingos, além dos feriados (art. 16).",
    "REGISTRO DE PONTO — É obrigatório o registro do horário de trabalho por meio idôneo (art. 12), inclusive por aplicativo eletrônico, cujas marcações não podem ser alteradas.",
    "FÉRIAS E 13º — O(A) EMPREGADO(A) terá direito a férias anuais remuneradas com acréscimo de 1/3 e ao 13º salário, nos termos da legislação.",
    `DESCONTOS — É vedado descontar alimentação, vestuário, higiene ou moradia (art. 18). Podem ser descontados: INSS, adiantamentos${e.custoValeTransporte ? ", vale-transporte até 6% do salário" : ""} e faltas injustificadas.`,
    "OBRIGAÇÕES — O(A) EMPREGADO(A) se compromete a cumprir com zelo suas atividades e a manter sigilo sobre a vida privada da família.",
    "FGTS E INSS — O(A) EMPREGADOR(A) recolherá mensalmente, pelo DAE do eSocial, as contribuições previdenciárias, o seguro contra acidentes, o FGTS e a indenização compensatória (LC 150, art. 34).",
    "FORO — Fica eleito o foro do local da prestação de serviços.",
  ];
  doc.clausulas(clausulas);
  doc.paragrafo(cidadeData(p));
  doc.assinaturas([{ nome: p.cliente.nome, papel: "Empregador(a)" }, { nome: e.nome, papel: "Empregado(a)" }]);
  doc.assinaturas([{ nome: "Testemunha 1", papel: "Nome e CPF" }, { nome: "Testemunha 2", papel: "Nome e CPF" }]);
  return doc.salvar();
}

export async function acordo(p: Partes, tipo: "COMPENSACAO" | "12X36" | "INTERVALO" | "VIAGEM") {
  const e = p.empregado!;
  const titulos = {
    COMPENSACAO: "ACORDO INDIVIDUAL DE COMPENSAÇÃO DE HORAS (BANCO DE HORAS)",
    "12X36": "ACORDO INDIVIDUAL DE JORNADA 12x36",
    INTERVALO: "ACORDO DE REDUÇÃO DO INTERVALO INTRAJORNADA",
    VIAGEM: "ACORDO PARA ACOMPANHAMENTO EM VIAGEM",
  };
  const textos = {
    COMPENSACAO: [
      "As horas trabalhadas além da jornada normal poderão ser compensadas com a correspondente diminuição em outro dia, nos termos do art. 2º, §§ 4º e 5º, da LC 150/2015.",
      "As primeiras 40 horas extras do mês serão pagas com adicional de 50%, salvo se compensadas dentro do próprio mês. O saldo que exceder 40 horas poderá ser compensado no período máximo de 1 ano.",
      "O saldo não compensado será pago como hora extra na rescisão ou ao fim do período de compensação.",
      "O controle será feito pelo registro de ponto, com acesso do(a) empregado(a) ao saldo mensal.",
    ],
    "12X36": [
      "As partes ajustam a jornada de 12 horas seguidas de trabalho por 36 horas ininterruptas de descanso, nos termos do art. 10 da LC 150/2015.",
      "Os intervalos para repouso e alimentação poderão ser observados ou indenizados.",
      "A remuneração mensal abrange os pagamentos devidos pelo descanso semanal remunerado e pelo descanso em feriados, que são considerados compensados, assim como as prorrogações de trabalho noturno, quando houver.",
    ],
    INTERVALO: ["O intervalo para repouso e alimentação, para jornadas acima de 6 horas, fica reduzido para 30 minutos diários, conforme o art. 13 da LC 150/2015."],
    VIAGEM: [
      "Nas viagens em que acompanhar o(a) empregador(a), serão consideradas apenas as horas efetivamente trabalhadas, podendo as excedentes ser compensadas em outro dia (LC 150, art. 11).",
      "A remuneração-hora do serviço em viagem será, no mínimo, 25% superior ao valor do salário-hora normal, podendo, mediante acordo, ser convertida em acréscimo no banco de horas.",
    ],
  };
  const doc = await DocPdf.criar({ titulo: titulos[tipo], rodape: AVISO });
  doc.titulo(titulos[tipo], 13).paragrafo(qualificacao(p));
  doc.clausulas([...textos[tipo], "Este acordo pode ser revogado por qualquer das partes mediante comunicação escrita, respeitados os direitos já adquiridos."]);
  doc.paragrafo(cidadeData(p));
  doc.assinaturas([{ nome: p.cliente.nome, papel: "Empregador(a)" }, { nome: e.nome, papel: "Empregado(a)" }]);
  return doc.salvar();
}

export async function contratoServico(p: Partes) {
  const c = p.config;
  const doc = await DocPdf.criar({ titulo: "Contrato de Prestação de Serviços", rodape: AVISO });
  doc.titulo("CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CONSULTORIA — eSOCIAL DOMÉSTICO", 13);
  doc.paragrafo(`CONTRATADA: ${c.nomeConsultoria}${c.documento ? `, CPF/CNPJ ${c.documento}` : ""}${c.endereco ? `, com endereço em ${c.endereco}` : ""}.\nCONTRATANTE: ${p.cliente.nome}, CPF ${formatarCpf(p.cliente.cpf)}, residente em ${endereco(p.cliente)}.`);
  doc.clausulas([
    "OBJETO — Prestação de serviços de apoio ao empregador doméstico no eSocial: cadastro e admissão, folha mensal, emissão do DAE, recibos, férias, 13º salário, rescisão e regularização de períodos atrasados, mediante procuração eletrônica outorgada pelo CONTRATANTE no portal do eSocial.",
    `PREÇO — Mensalidade de ${formatarMoeda(num(p.cliente.mensalidade))}, com vencimento todo dia ${p.cliente.diaVencimento}. Serviços avulsos (admissão, rescisão, regularização) serão cobrados conforme tabela de preços vigente, informada previamente.`,
    "RESPONSABILIDADES DO CONTRATANTE — (a) enviar até o dia 30 de cada mês as informações do mês (faltas, horas extras, adiantamentos, afastamentos) ou manter o ponto eletrônico atualizado; (b) pagar o DAE até o vencimento (dia 7 ou dia útil anterior); (c) pagar o salário e as verbas ao empregado nos prazos legais; (d) manter a procuração eletrônica válida; (e) comunicar imediatamente admissões, desligamentos, afastamentos e gravidez.",
    "RESPONSABILIDADES DA CONTRATADA — (a) emitir as guias (DAE) e recibos até o dia 4 do mês seguinte, desde que recebidas as informações no prazo; (b) manter o CONTRATANTE informado dos prazos e obrigações; (c) guardar sigilo e proteger os dados pessoais conforme a LGPD.",
    "LIMITES — A CONTRATADA não responde por multas ou encargos decorrentes de informações não enviadas, enviadas fora do prazo ou incorretas, nem pelo não pagamento das guias pelo CONTRATANTE. Os cálculos são feitos com base nas informações recebidas; questões judiciais devem ser tratadas com advogado.",
    "DADOS PESSOAIS — A CONTRATADA tratará os dados do CONTRATANTE e de seus empregados apenas para executar este contrato e cumprir obrigações legais (LGPD, art. 7º, II e V), mantendo registro de acessos e permitindo a exclusão dos dados ao fim do contrato, ressalvada a guarda legal.",
    "VIGÊNCIA E RESCISÃO — Prazo indeterminado, podendo ser rescindido por qualquer parte com aviso de 30 dias.",
    "FORO — Fica eleito o foro do domicílio do CONTRATANTE.",
  ]);
  doc.paragrafo(cidadeData(p));
  doc.assinaturas([{ nome: c.nomeConsultoria, papel: "Contratada" }, { nome: p.cliente.nome, papel: "Contratante" }]);
  return doc.salvar();
}

export async function avisoFerias(p: Partes, f: { inicioAquisitivo: Date; fimAquisitivo: Date; inicio: Date; dias: number; abono: number; retorno: Date; pagamento: Date }) {
  const e = p.empregado!;
  const doc = await DocPdf.criar({ titulo: "Aviso de Férias", rodape: AVISO });
  doc.titulo("AVISO DE FÉRIAS");
  doc.paragrafo(`Prezado(a) ${e.nome},`);
  doc.paragrafo(`Comunicamos, com a antecedência mínima de 30 dias (CLT, art. 135), que suas férias relativas ao período aquisitivo de ${formatarData(f.inicioAquisitivo)} a ${formatarData(f.fimAquisitivo)} serão concedidas conforme abaixo:`);
  doc.campos([
    ["Início das férias", formatarData(f.inicio)],
    ["Dias de descanso", `${f.dias} dias`],
    ["Abono pecuniário", f.abono ? `${f.abono} dias convertidos em dinheiro` : "não"],
    ["Retorno ao trabalho", formatarData(f.retorno)],
    ["Pagamento (férias + 1/3)", `até ${formatarData(f.pagamento)}`],
  ]);
  doc.paragrafo(cidadeData(p));
  doc.assinaturas([{ nome: p.cliente.nome, papel: "Empregador(a)" }, { nome: e.nome, papel: "Ciente — Empregado(a)" }]);
  return doc.salvar();
}

export async function reciboComMemoria(p: Partes, titulo: string, introducao: string, linhas: LinhaMemoria[], liquido: number) {
  const e = p.empregado!;
  const doc = await DocPdf.criar({ titulo, rodape: AVISO });
  doc.titulo(titulo.toUpperCase());
  doc.paragrafo(qualificacao(p));
  doc.paragrafo(introducao);
  const itens = linhas.filter((l) => l.valor !== undefined && (l.tipo ?? "moeda") === "moeda" && (l.descricao.startsWith("(+)") || l.descricao.startsWith("(−)")));
  const usar = itens.length ? itens : linhas.filter((l) => l.valor !== undefined && (l.tipo ?? "moeda") === "moeda" && !l.destaque);
  doc.tabela(["Descrição", "Referência", "Valor"], usar.map((l) => [l.descricao.replace(/^\([+−]\)\s*/, ""), l.formula ?? "", formatarMoeda(l.valor!)]), [230, 175, 90], { alinharDireita: [2] });
  doc.paragrafo(`VALOR LÍQUIDO: ${formatarMoeda(liquido)}`, { negrito: true, tamanho: 12 });
  doc.paragrafo(`Recebi de ${p.cliente.nome} a importância líquida acima, dando plena quitação dos valores discriminados neste recibo.`);
  doc.paragrafo(cidadeData(p));
  doc.assinaturas([{ nome: e.nome, papel: "Empregado(a)" }]);
  return doc.salvar();
}

export async function avisoPrevio(p: Partes, a: { quem: "EMPREGADOR" | "EMPREGADO"; data: Date; dias: number; modo: "TRABALHADO" | "INDENIZADO" | "DISPENSADO"; reducao?: "2H_DIA" | "7_DIAS" }) {
  const e = p.empregado!;
  const doc = await DocPdf.criar({ titulo: "Aviso Prévio", rodape: AVISO });
  if (a.quem === "EMPREGADOR") {
    doc.titulo("AVISO PRÉVIO DO EMPREGADOR");
    doc.paragrafo(`Prezado(a) ${e.nome},`);
    doc.paragrafo(`Comunicamos que, a partir de ${formatarData(a.data)}, damos por encerrado o contrato de trabalho mantido com V.Sa., concedendo aviso prévio de ${a.dias} dias (Lei 12.506/2011), que será ${a.modo === "INDENIZADO" ? "indenizado, ficando dispensado(a) do cumprimento" : "trabalhado"}.`);
    if (a.modo === "TRABALHADO") doc.paragrafo(`Durante o aviso, V.Sa. poderá optar pela redução de 2 horas diárias ou por faltar 7 dias corridos, sem prejuízo do salário (CLT, art. 488). Opção: ${a.reducao === "7_DIAS" ? "7 dias corridos" : a.reducao === "2H_DIA" ? "2 horas diárias" : "( ) 2 horas diárias  ( ) 7 dias corridos"}.`);
    doc.paragrafo("As verbas rescisórias serão pagas em até 10 dias contados do término do contrato (CLT, art. 477, § 6º).");
    doc.paragrafo(cidadeData(p));
    doc.assinaturas([{ nome: p.cliente.nome, papel: "Empregador(a)" }, { nome: e.nome, papel: "Ciente — Empregado(a)" }]);
  } else {
    doc.titulo("PEDIDO DE DEMISSÃO E AVISO PRÉVIO DO EMPREGADO");
    doc.paragrafo(`Ao(À) Sr.(a) ${p.cliente.nome},`);
    doc.paragrafo(`Eu, ${e.nome}, CPF ${formatarCpf(e.cpf)}, comunico que não é mais de meu interesse continuar trabalhando, pedindo demissão a partir de ${formatarData(a.data)}. ${a.modo === "TRABALHADO" ? "Cumprirei o aviso prévio de 30 dias." : a.modo === "DISPENSADO" ? "Solicito a dispensa do cumprimento do aviso prévio." : "Não cumprirei o aviso prévio, ciente de que o valor correspondente poderá ser descontado (CLT, art. 487, § 2º)."}`);
    doc.paragrafo(cidadeData(p));
    doc.assinaturas([{ nome: e.nome, papel: "Empregado(a)" }, { nome: p.cliente.nome, papel: "Ciente — Empregador(a)" }]);
  }
  return doc.salvar();
}

export async function reciboAdiantamento(p: Partes, valor: number, data: Date, referencia: string) {
  const e = p.empregado!;
  const doc = await DocPdf.criar({ titulo: "Recibo de Adiantamento", rodape: AVISO });
  doc.titulo("RECIBO DE ADIANTAMENTO SALARIAL");
  doc.paragrafo(`Recebi de ${p.cliente.nome}, CPF ${formatarCpf(p.cliente.cpf)}, a importância de ${formatarMoeda(valor)}, em ${formatarData(data)}, a título de adiantamento salarial referente a ${referencia}, que será descontada na folha de pagamento.`);
  doc.paragrafo(cidadeData(p));
  doc.assinaturas([{ nome: e.nome, papel: `Empregado(a) — CPF ${formatarCpf(e.cpf)}` }]);
  return doc.salvar();
}

export async function folhaPontoManual(p: Partes, ano: number, mes: number) {
  const e = p.empregado!;
  const doc = await DocPdf.criar({ titulo: "Folha de Ponto", rodape: AVISO });
  doc.titulo(`FOLHA DE PONTO — ${nomeMes(mes).toUpperCase()}/${ano}`, 13);
  doc.campos([["Empregador(a)", `${p.cliente.nome} — CPF ${formatarCpf(p.cliente.cpf)}`], ["Empregado(a)", `${e.nome} — CPF ${formatarCpf(e.cpf)} — ${e.funcao}`], ["Jornada", descreverJornada(e)]]);
  doc.tabela(["Dia", "Entrada", "Saída interv.", "Retorno", "Saída", "Extras", "Rubrica"], diasDoMes(ano, mes).map((d) => [`${formatarData(d).slice(0, 5)} ${NOMES_DIAS_SEMANA[DIAS_SEMANA[d.getUTCDay()]].slice(0, 3)}`, "", "", "", "", "", ""]), [70, 70, 75, 70, 70, 60, 80], { tamanho: 8 });
  doc.assinaturas([{ nome: e.nome, papel: "Empregado(a)" }, { nome: p.cliente.nome, papel: "Empregador(a)" }]);
  return doc.salvar();
}

export async function espelhoPonto(p: Partes, ano: number, mes: number, dias: ResultadoDia[], resumo: { rotulo: string; valor: string }[], marcacoes: { nsr: number; tipo: string; dataHora: Date; origem: string }[]) {
  const e = p.empregado!;
  const doc = await DocPdf.criar({ titulo: "Espelho de Ponto", rodape: `${AVISO} Registros inalteráveis com hash SHA-256 encadeado.` });
  doc.titulo(`ESPELHO DE PONTO — ${nomeMes(mes).toUpperCase()}/${ano}`, 13);
  doc.campos([["Empregador(a)", `${p.cliente.nome} — CPF ${formatarCpf(p.cliente.cpf)}`], ["Empregado(a)", `${e.nome} — CPF ${formatarCpf(e.cpf)}`], ["Regime", `${NOMES_REGIME[e.regime]} — ${formatarNumero(num(e.horasSemanais))}h semanais`]]);
  doc.tabela(
    ["Dia", "Marcações", "Trabalhado", "Extras", "Noturno", "Falta/atraso"],
    dias.map((d) => [
      `${formatarData(d.data).slice(0, 5)} ${NOMES_DIAS_SEMANA[DIAS_SEMANA[d.data.getUTCDay()]].slice(0, 3)}`,
      d.pares.map((x) => `${x.entrada}-${x.saida}`).join(" ") || (d.faltaJustificada ? "abonado" : d.previsto ? "-" : "folga"),
      d.trabalhadoComputado ? minutosParaHora(d.trabalhadoComputado) : "",
      d.extras50 ? `${minutosParaHora(d.extras50)} 50%` : d.extras100 ? `${minutosParaHora(d.extras100)} 100%` : "",
      d.noturnoReal ? `${formatarNumero(d.noturnoConvertido / 60)}h` : "",
      d.falta ? "falta" : d.atraso ? minutosParaHora(d.atraso) : "",
    ]),
    [60, 165, 65, 75, 55, 75],
    { tamanho: 8 },
  );
  doc.subtitulo("Resumo do mês");
  doc.campos(resumo.map((r) => [r.rotulo, r.valor] as [string, string]));
  doc.subtitulo("Marcações originais (NSR)");
  doc.tabela(["NSR", "Tipo", "Data e hora", "Origem"], marcacoes.map((m) => [String(m.nsr).padStart(9, "0"), m.tipo, m.dataHora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }), m.origem.toLowerCase()]), [80, 140, 170, 105], { tamanho: 7 });
  doc.paragrafo("Declaro que as marcações acima correspondem à minha jornada no período.", { tamanho: 9 });
  doc.assinaturas([{ nome: e.nome, papel: "Empregado(a)" }, { nome: p.cliente.nome, papel: "Empregador(a)" }]);
  return doc.salvar();
}

export async function informeRendimentos(p: Partes, ano: number, totais: { rendimentos: number; inss: number; decimoTerceiro: number; inss13: number; salarioFamilia: number }) {
  const e = p.empregado!;
  const doc = await DocPdf.criar({ titulo: "Informe de Rendimentos", rodape: AVISO });
  doc.titulo(`INFORME ANUAL DE RENDIMENTOS — ANO-CALENDÁRIO ${ano}`, 13);
  doc.campos([["Fonte pagadora (empregador)", `${p.cliente.nome} — CPF ${formatarCpf(p.cliente.cpf)}`], ["Beneficiário (empregado)", `${e.nome} — CPF ${formatarCpf(e.cpf)}`]]);
  doc.tabela(["Descrição", "Valor"], [
    ["Total dos rendimentos (salários, férias, extras)", formatarMoeda(totais.rendimentos)],
    ["Contribuição previdenciária oficial (INSS)", formatarMoeda(totais.inss)],
    ["13º salário (tributação exclusiva)", formatarMoeda(totais.decimoTerceiro)],
    ["INSS sobre o 13º", formatarMoeda(totais.inss13)],
    ["Salário-família (isento)", formatarMoeda(totais.salarioFamilia)],
  ], [380, 115], { alinharDireita: [1] });
  doc.paragrafo("Valores estimados com base nas folhas registradas no sistema. Confira com os recibos do eSocial antes de usar na declaração de Imposto de Renda.", { tamanho: 9 });
  doc.paragrafo(cidadeData(p));
  doc.assinaturas([{ nome: p.cliente.nome, papel: "Empregador(a)" }]);
  return doc.salvar();
}

export async function propostaComercial(config: Configuracao, lead: { nome: string; qtdEmpregados: number; cidade?: string | null }, itens: { descricao: string; valor: number; unidade: string }[], total: number) {
  const doc = await DocPdf.criar({ titulo: "Proposta Comercial", rodape: `${config.nomeConsultoria}${config.telefone ? ` · ${config.telefone}` : ""}${config.email ? ` · ${config.email}` : ""}` });
  doc.titulo("PROPOSTA DE SERVIÇOS — eSOCIAL DOMÉSTICO", 14);
  doc.paragrafo(`Para: ${lead.nome}${lead.cidade ? ` (${lead.cidade})` : ""}`);
  doc.paragrafo(`Cuidamos de toda a rotina do seu empregado doméstico no eSocial, para você ficar em dia com a lei sem dor de cabeça: folha mensal, DAE, recibos, férias, 13º, rescisões e alertas automáticos de prazos.`);
  doc.tabela(["Serviço", "Unidade", "Valor"], itens.map((i) => [i.descricao, i.unidade.replace("_", " "), formatarMoeda(i.valor)]), [280, 120, 95], { alinharDireita: [2] });
  doc.paragrafo(`Mensalidade estimada para ${lead.qtdEmpregados} empregado(s): ${formatarMoeda(total)}`, { negrito: true, tamanho: 12 });
  doc.subtitulo("O que está incluso");
  for (const t of ["Folha mensal e DAE emitido até o dia 4", "Recibos e documentos em PDF com assinatura eletrônica", "Aplicativo de ponto para o empregado", "Portal com simuladores e calendário de vencimentos", "Lembretes automáticos de DAE, férias e 13º", "Atendimento por WhatsApp"]) doc.paragrafo(`• ${t}`, { recuo: 10, espaco: 2 });
  doc.espaco(10).paragrafo(`Proposta válida por 15 dias. ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`);
  doc.assinaturas([{ nome: config.nomeConsultoria, papel: "Consultoria" }]);
  return doc.salvar();
}
