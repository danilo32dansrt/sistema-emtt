"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { gerarHashSenha, gerarSenhaProvisoria } from "@/lib/auth/senha";
import { exigirConsultor } from "@/lib/auth/sessao";
import {
  addMeses, cpfValido, DIAS_SEMANA, formatarData, formatarMoeda, horasSemanaisDaJornada, idade, NOMES_RESCISAO, validarFracionamento, type JornadaSemanal,
} from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { ORIENTACAO_AFASTAMENTO } from "@/lib/orientacoes";
import { checkbox, cpfCampo, dadosDoForm, dataCampo, dataOpcional, moeda, numero, texto, textoOpcional } from "@/lib/formularios";

const esquema = z.object({
  clienteId: z.string().min(1),
  nome: texto("o nome"),
  cpf: cpfCampo.refine(cpfValido, "CPF do empregado inválido."),
  nascimento: dataOpcional,
  telefone: textoOpcional,
  funcao: texto("a função"),
  cbo: texto("o CBO"),
  admissao: dataCampo("a data de admissão"),
  salario: moeda("salário"),
  regime: z.enum(["INTEGRAL", "PARCIAL", "DOZE_X_TRINTA_SEIS"]),
  diasExperiencia: z.string().optional().transform((v) => (v ? Number(v) : null)).pipe(z.number().int().min(1).max(90, "Experiência: máximo de 90 dias.").nullable()),
  acordoCompensacao: checkbox,
  acordoIntervaloReduzido: checkbox,
  acordo12x36: checkbox,
  acordoViagem: checkbox,
  residenteNoLocal: checkbox,
  referencia12x36: dataOpcional,
  toleranciaMinutos: numero("tolerância", 0, 5),
  dependentesSalarioFamilia: numero("dependentes", 0, 20),
  custoValeTransporte: z.string().optional().transform((v) => (v ? v : "0")).pipe(moeda("vale-transporte")),
  gestante: checkbox,
  dataPrevistaParto: dataOpcional,
  estabilidadeAte: dataOpcional,
  estabilidadeMotivo: textoOpcional,
  pontoAtivo: checkbox,
  exigirSelfie: checkbox,
  exigirLocalizacao: checkbox,
  observacoes: textoOpcional,
});

function lerJornada(fd: FormData) {
  const jornada: JornadaSemanal = {};
  const horarios: Record<string, { entrada: string; saida: string }> = {};
  for (const d of DIAS_SEMANA) {
    const h = Number(String(fd.get(`horas_${d}`) ?? "").replace(",", "."));
    if (h > 0) {
      if (h > 12) throw new Error("Jornada diária não pode passar de 12 horas.");
      jornada[d] = h;
    }
    const entrada = String(fd.get(`entrada_${d}`) ?? "");
    const saida = String(fd.get(`saida_${d}`) ?? "");
    if (entrada && saida) horarios[d] = { entrada, saida };
  }
  return { jornada, horarios: Object.keys(horarios).length ? horarios : null };
}

export async function salvarEmpregado(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  const id = fd.get("id")?.toString() || null;
  let destino: string;
  try {
    const d = esquema.parse(dadosDoForm(fd));
    const { jornada, horarios } = lerJornada(fd);
    const horasSemanais = horasSemanaisDaJornada(jornada);
    if (horasSemanais <= 0) return { erro: "Informe as horas trabalhadas em pelo menos um dia da semana." };
    if (d.nascimento && idade(d.nascimento, d.admissao) < 18) return { erro: "É proibida a contratação de menor de 18 anos para trabalho doméstico." };
    if (d.regime === "DOZE_X_TRINTA_SEIS" && !d.referencia12x36) d.referencia12x36 = d.admissao;
    if (d.gestante && d.dataPrevistaParto && !d.estabilidadeAte) {
      d.estabilidadeAte = addMeses(d.dataPrevistaParto, 5);
      d.estabilidadeMotivo = "gestante (até 5 meses após o parto)";
    }
    const dados = { ...d, jornada, horarios: horarios ?? undefined, horasSemanais, custoValeTransporte: d.custoValeTransporte || null };

    if (id) {
      const antes = await prisma.empregado.findUniqueOrThrow({ where: { id } });
      await prisma.empregado.update({ where: { id }, data: dados });
      const historico = [];
      if (num(antes.salario) !== d.salario) historico.push({ tipo: "ALTERACAO_SALARIAL", descricao: `Salário alterado de ${formatarMoeda(num(antes.salario))} para ${formatarMoeda(d.salario)}` });
      if (num(antes.horasSemanais) !== horasSemanais || antes.regime !== d.regime) historico.push({ tipo: "ALTERACAO_JORNADA", descricao: `Jornada alterada para ${horasSemanais}h semanais (${d.regime.toLowerCase()})` });
      if (historico.length) await prisma.historicoEmpregado.createMany({ data: historico.map((h) => ({ ...h, empregadoId: id, data: new Date() })) });
      await registrarAtividade({ usuarioId: u.id, clienteId: d.clienteId, acao: "EMPREGADO_ALTERADO", descricao: `Cadastro de ${d.nome} alterado`, entidade: "Empregado", entidadeId: id });
      destino = `/consultor/empregados/${id}`;
    } else {
      const e = await prisma.empregado.create({ data: dados });
      await prisma.historicoEmpregado.create({ data: { empregadoId: e.id, data: d.admissao, tipo: "ADMISSAO", descricao: `Admissão como ${d.funcao}, salário ${formatarMoeda(d.salario)}, ${horasSemanais}h semanais` } });
      await registrarAtividade({ usuarioId: u.id, clienteId: d.clienteId, acao: "EMPREGADO_CRIADO", descricao: `Empregado ${d.nome} cadastrado`, entidade: "Empregado", entidadeId: e.id });
      destino = `/consultor/empregados/${e.id}`;
    }
  } catch (e) {
    return erroParaEstado(e);
  }
  revalidatePath("/consultor");
  redirect(destino);
}

const esquemaFerias = z.object({
  empregadoId: z.string(),
  inicioAquisitivo: dataCampo("o início do período aquisitivo"),
  inicioGozo: dataCampo("o início das férias"),
  dias: numero("dias", 1, 30),
  diasAbono: numero("abono", 0, 10),
  diasDireito: numero("direito", 0, 30),
  valorLiquido: z.string().optional().transform((v) => v || "0").pipe(moeda("valor")),
  observacoes: textoOpcional,
});

export async function registrarFerias(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = esquemaFerias.parse(dadosDoForm(fd));
    const anteriores = await prisma.ferias.findMany({ where: { empregadoId: d.empregadoId, inicioAquisitivo: d.inicioAquisitivo } });
    const periodos = [...anteriores.map((f) => f.dias), d.dias];
    const abono = anteriores.reduce((t, f) => t + f.diasAbono, 0) + d.diasAbono;
    const direito = d.diasDireito || 30;
    // Valida só as regras que já podem ser conferidas (o 2º período pode ser lançado depois)
    const erros = validarFracionamento(periodos, direito, abono).filter((e) => periodos.length === 2 || !e.includes("14 dias"));
    if (erros.length) return { erro: erros[0] };
    const emp = await prisma.empregado.findUniqueOrThrow({ where: { id: d.empregadoId } });
    await prisma.ferias.create({ data: { empregadoId: d.empregadoId, inicioAquisitivo: d.inicioAquisitivo, inicioGozo: d.inicioGozo, dias: d.dias, diasAbono: d.diasAbono, valorLiquido: d.valorLiquido || null, observacoes: d.observacoes } });
    await prisma.historicoEmpregado.create({ data: { empregadoId: d.empregadoId, data: d.inicioGozo, tipo: "FERIAS", descricao: `Férias de ${d.dias} dias a partir de ${formatarData(d.inicioGozo)}${d.diasAbono ? ` + ${d.diasAbono} dias de abono` : ""}` } });
    await registrarAtividade({ usuarioId: u.id, clienteId: emp.clienteId, acao: "FERIAS_PROGRAMADAS", descricao: `Férias de ${emp.nome} programadas para ${formatarData(d.inicioGozo)}` });
    revalidatePath(`/consultor/empregados/${d.empregadoId}`);
    return { ok: true, mensagem: "Férias registradas. Os alertas de aviso e pagamento já estão na agenda." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function excluirFerias(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  const f = await prisma.ferias.delete({ where: { id: String(fd.get("id")) }, include: { empregado: true } });
  await registrarAtividade({ usuarioId: u.id, clienteId: f.empregado.clienteId, acao: "FERIAS_EXCLUIDAS", descricao: `Registro de férias de ${f.empregado.nome} (${formatarData(f.inicioGozo)}) excluído` });
  revalidatePath(`/consultor/empregados/${f.empregadoId}`);
  return { ok: true };
}

const esquemaAfastamento = z.object({
  empregadoId: z.string(),
  tipo: z.enum(["ATESTADO", "LICENCA_MATERNIDADE", "AUXILIO_INCAPACIDADE", "ACIDENTE_TRABALHO", "OUTRO"]),
  inicio: dataCampo("o início"),
  fim: dataOpcional,
  observacoes: textoOpcional,
});


export async function registrarAfastamento(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = esquemaAfastamento.parse(dadosDoForm(fd));
    const emp = await prisma.empregado.findUniqueOrThrow({ where: { id: d.empregadoId } });
    let fim = d.fim;
    if (d.tipo === "LICENCA_MATERNIDADE" && !fim) fim = new Date(d.inicio.getTime() + 119 * 86400000);
    await prisma.afastamento.create({ data: { ...d, fim } });
    const dadosEmp: Record<string, unknown> = {};
    if (d.tipo !== "ATESTADO" && (!fim || fim >= new Date())) dadosEmp.situacao = "AFASTADO";
    if (d.tipo === "ACIDENTE_TRABALHO" && fim) {
      dadosEmp.estabilidadeAte = addMeses(fim, 12);
      dadosEmp.estabilidadeMotivo = "acidente de trabalho (12 meses após o retorno)";
    }
    if (Object.keys(dadosEmp).length) await prisma.empregado.update({ where: { id: emp.id }, data: dadosEmp });
    await prisma.historicoEmpregado.create({ data: { empregadoId: emp.id, data: d.inicio, tipo: "AFASTAMENTO", descricao: `Afastamento (${d.tipo.toLowerCase().replace(/_/g, " ")}) de ${formatarData(d.inicio)}${fim ? ` a ${formatarData(fim)}` : ""}` } });
    await registrarAtividade({ usuarioId: u.id, clienteId: emp.clienteId, acao: "AFASTAMENTO", descricao: `Afastamento de ${emp.nome} registrado` });
    revalidatePath(`/consultor/empregados/${emp.id}`);
    return { ok: true, mensagem: ORIENTACAO_AFASTAMENTO[d.tipo] };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function encerrarAfastamento(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  const id = String(fd.get("empregadoId"));
  await prisma.empregado.update({ where: { id }, data: { situacao: "ATIVO" } });
  await prisma.historicoEmpregado.create({ data: { empregadoId: id, data: new Date(), tipo: "OCORRENCIA", descricao: "Retorno ao trabalho" } });
  revalidatePath(`/consultor/empregados/${id}`);
  return { ok: true };
}

export async function registrarOcorrencia(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  await exigirConsultor();
  try {
    const d = z.object({ empregadoId: z.string(), data: dataCampo("a data"), descricao: texto("a descrição") }).parse(dadosDoForm(fd));
    await prisma.historicoEmpregado.create({ data: { ...d, tipo: "OCORRENCIA" } });
    revalidatePath(`/consultor/empregados/${d.empregadoId}`);
    return { ok: true, mensagem: "Ocorrência registrada." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function registrarDesligamento(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = z.object({ empregadoId: z.string(), data: dataCampo("a data de desligamento"), tipo: z.string().min(1), observacoes: textoOpcional }).parse(dadosDoForm(fd));
    const emp = await prisma.empregado.findUniqueOrThrow({ where: { id: d.empregadoId } });
    if (d.data < emp.admissao) return { erro: "Desligamento antes da admissão." };
    const motivo = NOMES_RESCISAO[d.tipo as keyof typeof NOMES_RESCISAO] ?? d.tipo;
    await prisma.empregado.update({ where: { id: emp.id }, data: { situacao: "DESLIGADO", desligamento: d.data, motivoDesligamento: motivo, pontoAtivo: false } });
    await prisma.usuario.updateMany({ where: { empregadoId: emp.id }, data: { ativo: false } });
    await prisma.historicoEmpregado.create({ data: { empregadoId: emp.id, data: d.data, tipo: "DESLIGAMENTO", descricao: `Desligamento: ${motivo}${d.observacoes ? ` — ${d.observacoes}` : ""}` } });
    await registrarAtividade({ usuarioId: u.id, clienteId: emp.clienteId, acao: "DESLIGAMENTO", descricao: `${emp.nome} desligado(a) em ${formatarData(d.data)} (${motivo})` });
    revalidatePath(`/consultor/empregados/${emp.id}`);
    return { ok: true, mensagem: "Desligamento registrado. O acesso ao ponto foi encerrado; os registros ficam guardados por 5 anos." };
  } catch (e) {
    return erroParaEstado(e);
  }
}

/** Cria o acesso do empregado ao aplicativo de ponto. */
export async function criarAcessoEmpregado(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const empregadoId = z.string().parse(fd.get("empregadoId"));
    const email = z.string().trim().toLowerCase().email("Informe um e-mail válido.").parse(fd.get("email"));
    const emp = await prisma.empregado.findUniqueOrThrow({ where: { id: empregadoId } });
    const senha = gerarSenhaProvisoria();
    const senhaHash = await gerarHashSenha(senha);
    const existente = await prisma.usuario.findUnique({ where: { empregadoId } });
    const outro = await prisma.usuario.findUnique({ where: { email } });
    if (outro && outro.id !== existente?.id) return { erro: "Este e-mail já é usado por outro acesso." };
    if (existente) await prisma.usuario.update({ where: { id: existente.id }, data: { email, senhaHash, ativo: true, trocarSenha: true, tentativasFalhas: 0, bloqueadoAte: null } });
    else await prisma.usuario.create({ data: { email, senhaHash, nome: emp.nome, papel: "EMPREGADO", clienteId: emp.clienteId, empregadoId, trocarSenha: true } });
    await prisma.empregado.update({ where: { id: empregadoId }, data: { pontoAtivo: true } });
    await registrarAtividade({ usuarioId: u.id, clienteId: emp.clienteId, acao: "ACESSO_EMPREGADO", descricao: `Acesso ao ponto liberado para ${emp.nome}` });
    revalidatePath(`/consultor/empregados/${empregadoId}`);
    return { ok: true, mensagem: `Acesso ao ponto pronto! E-mail: ${email} — senha provisória: ${senha}` };
  } catch (e) {
    return erroParaEstado(e);
  }
}
