/**
 * Carga inicial: tabelas anuais, configurações, modelos e DADOS DE EXEMPLO.
 * Rode com: npm run db:seed
 *
 * Usuários de exemplo (troque as senhas antes de usar de verdade!):
 *   consultor@exemplo.com.br / Consultor123
 *   suely@exemplo.com.br     / Cliente123   (portal do cliente)
 *   maria@exemplo.com.br     / Empregada123 (aplicativo de ponto)
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { TABELAS_PADRAO, addDias, data, diaSemana, ehFeriado, hojeBrasil, instanteLocal } from "../src/lib/calculos";
import { MODELOS_PADRAO } from "../src/lib/whatsapp";
import { hashMarcacao } from "../src/lib/ponto/hash";

const prisma = new PrismaClient();
const somenteTabelas = process.argv.includes("--somente-tabelas");

async function tabelas() {
  for (const t of Object.values(TABELAS_PADRAO)) {
    const dados = {
      salarioMinimo: t.salarioMinimo,
      faixasInss: t.faixasInss as unknown as Prisma.InputJsonValue,
      salarioFamiliaLimite: t.salarioFamiliaLimite,
      salarioFamiliaCota: t.salarioFamiliaCota,
      ...t.aliquotas,
      arredondamentoDae: t.arredondamentoDae,
      observacoes: "Valores padrão da carga inicial — confira com as portarias oficiais do ano.",
    };
    await prisma.tabelaAnual.upsert({ where: { ano: t.ano }, create: { ano: t.ano, ...dados }, update: {} });
  }
  await prisma.configuracao.upsert({ where: { id: "principal" }, create: { id: "principal", nomeConsultoria: "Consultoria eSocial Doméstico", cidade: "São Paulo", uf: "SP" }, update: {} });
  for (const m of MODELOS_PADRAO) await prisma.modeloMensagem.upsert({ where: { chave: m.chave }, create: m, update: {} });
  const precos = [
    { servico: "Mensalidade — 1 empregado", valor: 150, unidade: "mensal" },
    { servico: "Empregado adicional", valor: 60, unidade: "por_empregado" },
    { servico: "Admissão", valor: 200, unidade: "avulso" },
    { servico: "Rescisão", valor: 300, unidade: "avulso" },
    { servico: "Regularização (por mês atrasado)", valor: 50, unidade: "avulso" },
  ];
  for (const p of precos) await prisma.tabelaPreco.upsert({ where: { servico: p.servico }, create: p, update: {} });
}

async function conhecimento() {
  if (await prisma.artigo.count()) return;
  await prisma.artigo.createMany({
    data: [
      { categoria: "DAE", titulo: "O que é o DAE e quando vence?", conteudo: "O DAE (Documento de Arrecadação do eSocial) reúne num só boleto o INSS da empregada, o INSS do patrão (8%), o seguro contra acidentes (0,8%), o FGTS (8%) e o FGTS compensatório (3,2%). Vence todo dia 7 do mês seguinte; se o dia 7 não for dia útil, o vencimento é antecipado." },
      { categoria: "Férias", titulo: "Como funcionam as férias da empregada doméstica?", conteudo: "A cada 12 meses de trabalho a empregada ganha direito a 30 dias de férias, que devem ser concedidas nos 12 meses seguintes. O aviso é feito com 30 dias de antecedência e o pagamento (salário + 1/3) até 2 dias antes. As férias podem ser divididas em até 2 períodos, um deles com pelo menos 14 dias. Se passar do prazo, o valor é pago em dobro." },
      { categoria: "13º salário", titulo: "Quando pagar o 13º salário?", conteudo: "A 1ª parcela (metade, sem desconto de INSS) vai até 30 de novembro. A 2ª parcela, com o desconto do INSS, vai até 20 de dezembro, junto com o DAE do 13º." },
      { categoria: "Jornada", titulo: "Qual a jornada máxima da doméstica?", conteudo: "Até 8 horas por dia e 44 horas por semana no regime integral; até 25 horas semanais (e 6 por dia) no tempo parcial. Horas a mais são horas extras com adicional de 50%, e o registro de ponto é obrigatório." },
      { categoria: "Diarista", titulo: "Diarista ou mensalista?", conteudo: "Quem trabalha até 2 dias por semana na mesma casa é diarista, sem vínculo. A partir de 3 dias por semana é empregada doméstica, com registro obrigatório no eSocial." },
      { categoria: "Rescisão", titulo: "Qual o prazo para pagar a rescisão?", conteudo: "As verbas rescisórias devem ser pagas em até 10 dias corridos após o fim do contrato, em qualquer tipo de desligamento." },
    ],
  });
  await prisma.respostaPronta.createMany({
    data: [
      { categoria: "DAE", titulo: "DAE pago", texto: "Recebemos a confirmação do pagamento do DAE. Obrigado! O recibo já está disponível no portal." },
      { categoria: "Informações", titulo: "Pedido de informações", texto: "Para fechar a folha, informe pelo portal as faltas, horas extras e adiantamentos do mês até o dia 30." },
      { categoria: "Geral", titulo: "Recebido", texto: "Recebido! Vou verificar e te retorno ainda hoje." },
    ],
  });
}

async function exemplos() {
  if (await prisma.cliente.count()) {
    console.log("Já existem clientes — dados de exemplo não foram recriados.");
    return;
  }
  const hoje = hojeBrasil();
  const hash = (s: string) => bcrypt.hashSync(s, 12);

  await prisma.usuario.upsert({
    where: { email: "consultor@exemplo.com.br" },
    create: { email: "consultor@exemplo.com.br", nome: "Consultor(a) Responsável", papel: "CONSULTOR", senhaHash: hash("Consultor123") },
    update: {},
  });

  const suely = await prisma.cliente.create({
    data: {
      nome: "Suely Exemplo", cpf: "52998224725", telefone: "11987654321", email: "suely@exemplo.com.br", endereco: "Rua das Flores, 100", cidade: "São Paulo", uf: "SP",
      inicioContrato: data(2026, 2, 1), mensalidade: 150, diaVencimento: 10, procuracaoStatus: "ATIVA", procuracaoValidade: addDias(hoje, 25),
      observacoes: "Cliente de exemplo baseada no caso real conferido com o eSocial.",
    },
  });
  const carlos = await prisma.cliente.create({
    data: {
      nome: "Carlos Exemplo", cpf: "11144477735", telefone: "11912345678", email: "carlos@exemplo.com.br", cidade: "Campinas", uf: "SP",
      inicioContrato: data(2024, 6, 1), mensalidade: 210, diaVencimento: 5, procuracaoStatus: "ATIVA", procuracaoValidade: addDias(hoje, 200),
    },
  });

  const semana = (h: number, dias: string[]) => Object.fromEntries(dias.map((d) => [d, h]));
  const maria = await prisma.empregado.create({
    data: {
      clienteId: suely.id, nome: "Maria Exemplo da Silva", cpf: "39053344705", nascimento: data(1985, 5, 10), funcao: "Empregada doméstica", cbo: "5121-05",
      admissao: data(2026, 2, 9), salario: 810.5, regime: "PARCIAL", horasSemanais: 22, jornada: semana(4.4, ["seg", "ter", "qua", "qui", "sex"]),
      horarios: Object.fromEntries(["seg", "ter", "qua", "qui", "sex"].map((d) => [d, { entrada: "08:00", saida: "12:24" }])),
      diasExperiencia: 90, pontoAtivo: true, exigirSelfie: false, observacoes: "Tempo parcial de 22h semanais (exemplo do guia).",
    },
  });
  const joana = await prisma.empregado.create({
    data: {
      clienteId: carlos.id, nome: "Joana Exemplo Integral", cpf: "86288366757", nascimento: data(1979, 3, 2), funcao: "Empregada doméstica", cbo: "5121-05",
      admissao: data(2024, 7, 1), salario: 1900, regime: "INTEGRAL", horasSemanais: 44, jornada: { ...semana(8, ["seg", "ter", "qua", "qui", "sex"]), sab: 4 },
      horarios: Object.fromEntries(["seg", "ter", "qua", "qui", "sex"].map((d) => [d, { entrada: "08:00", saida: "17:00" }])),
      dependentesSalarioFamilia: 1, custoValeTransporte: 220, acordoCompensacao: true, pontoAtivo: true, exigirSelfie: false,
    },
  });
  const ana = await prisma.empregado.create({
    data: {
      clienteId: carlos.id, nome: "Ana Exemplo Cuidadora 12x36", cpf: "71428793860", nascimento: data(1990, 8, 20), funcao: "Cuidadora de idosos", cbo: "5162-10",
      admissao: data(2025, 3, 10), salario: 2300, regime: "DOZE_X_TRINTA_SEIS", horasSemanais: 42, jornada: { seg: 12, qua: 12, sex: 12, dom: 6 },
      acordo12x36: true, acordoIntervaloReduzido: true, referencia12x36: data(2025, 3, 10), pontoAtivo: true, exigirSelfie: false,
      observacoes: "Plantão noturno das 19h às 7h (exemplo de 12x36 com adicional noturno).",
    },
  });
  const rosa = await prisma.empregado.create({
    data: {
      clienteId: suely.id, nome: "Rosa Exemplo Noturna", cpf: "15350946056", nascimento: data(1975, 11, 5), funcao: "Cuidadora de idosos", cbo: "5162-10",
      admissao: data(2025, 9, 1), salario: 1800, regime: "INTEGRAL", horasSemanais: 40, jornada: semana(8, ["seg", "ter", "qua", "qui", "sex"]),
      horarios: Object.fromEntries(["seg", "ter", "qua", "qui", "sex"].map((d) => [d, { entrada: "22:00", saida: "07:00" }])),
      acordoIntervaloReduzido: false, pontoAtivo: false,
      observacoes: "Jornada noturna das 22h às 7h com 1h de intervalo (hora noturna reduzida e adicional de 20%).",
    },
  });

  for (const e of [maria, joana, ana, rosa]) {
    await prisma.historicoEmpregado.create({ data: { empregadoId: e.id, data: e.admissao, tipo: "ADMISSAO", descricao: `Admissão como ${e.funcao}` } });
  }
  await prisma.usuario.create({ data: { email: "suely@exemplo.com.br", nome: suely.nome, papel: "CLIENTE", clienteId: suely.id, senhaHash: hash("Cliente123") } });
  await prisma.usuario.create({ data: { email: "maria@exemplo.com.br", nome: maria.nome, papel: "EMPREGADO", clienteId: suely.id, empregadoId: maria.id, senhaHash: hash("Empregada123") } });

  // Férias já gozadas pela Joana (1º período)
  await prisma.ferias.create({ data: { empregadoId: joana.id, inicioAquisitivo: data(2024, 7, 1), inicioGozo: data(2025, 9, 1), dias: 30 } });

  // Checklist de fevereiro/2026 da Maria, com o DAE real
  await prisma.competencia.create({
    data: { empregadoId: maria.id, ano: 2026, mes: 2, infoRecebida: true, folhaLancada: true, folhaEncerrada: true, daeEmitido: true, daeEnviado: true, pagamentoConfirmado: true, reciboArquivado: true, daeValor: 159.18, daeCodigo: "Exemplo" },
  });

  // Mensalidades
  for (const c of [suely, carlos]) {
    for (let k = 2; k >= 0; k--) {
      const ref = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - k, 1));
      const ano = ref.getUTCFullYear();
      const mes = ref.getUTCMonth() + 1;
      const venc = data(ano, mes, c.diaVencimento);
      await prisma.mensalidade.create({ data: { clienteId: c.id, ano, mes, valor: c.mensalidade, vencimento: venc, status: k > 0 && c.id === suely.id ? "PAGO" : "ABERTO", pagoEm: k > 0 && c.id === suely.id ? venc : null, formaPagamento: k > 0 && c.id === suely.id ? "Pix" : null } });
    }
  }

  // Marcações de ponto dos últimos 10 dias (Maria: parcial; Joana: integral; Ana: 12x36 noturno)
  async function marcar(empregadoId: string, cpf: string, dia: Date, horas: string[], tipos: ("ENTRADA" | "SAIDA_INTERVALO" | "RETORNO_INTERVALO" | "SAIDA")[], diaSeguinteDaUltima = false) {
    let anterior = (await prisma.marcacaoPonto.findFirst({ where: { empregadoId }, orderBy: { nsr: "desc" } }))?.hash ?? null;
    for (let i = 0; i < horas.length; i++) {
      const dataHora = instanteLocal(diaSeguinteDaUltima && i === horas.length - 1 ? addDias(dia, 1) : dia, horas[i]);
      if (dataHora.getTime() > Date.now()) return;
      const idLocal = randomUUID();
      const h = hashMarcacao({ hashAnterior: anterior, empregadoId, cpf, tipo: tipos[i], dataHora, idLocal });
      await prisma.marcacaoPonto.create({ data: { empregadoId, tipo: tipos[i], dataHora, idLocal, hash: h, hashAnterior: anterior, origem: "ONLINE", dispositivo: "carga de exemplo" } });
      anterior = h;
    }
  }
  for (let k = 10; k >= 1; k--) {
    const dia = addDias(hoje, -k);
    const ds = diaSemana(dia);
    if (ehFeriado(dia)) continue;
    if (ds >= 1 && ds <= 5) {
      await marcar(maria.id, maria.cpf, dia, ["08:00", k === 3 ? "13:10" : "12:25"], ["ENTRADA", "SAIDA"]);
      await marcar(joana.id, joana.cpf, dia, ["07:58", "12:00", "13:00", k === 2 ? "18:30" : "17:02"], ["ENTRADA", "SAIDA_INTERVALO", "RETORNO_INTERVALO", "SAIDA"]);
    }
    if (k % 2 === 0) await marcar(ana.id, ana.cpf, dia, ["19:00", "23:00", "23:30", "07:00"], ["ENTRADA", "SAIDA_INTERVALO", "RETORNO_INTERVALO", "SAIDA"], true);
  }

  await prisma.lead.create({ data: { nome: "Paula Interessada", telefone: "11955554444", cidade: "São Paulo", qtdEmpregados: 1, status: "PROPOSTA", origem: "Indicação", observacoes: "Tem babá sem registro há 8 meses — oferecer regularização." } });
  console.log("Dados de exemplo criados.");
}

async function main() {
  await tabelas();
  if (somenteTabelas) return;
  await conhecimento();
  await exemplos();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
