"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { erroParaEstado, type EstadoAcao } from "@/lib/acoes";
import { registrarAtividade } from "@/lib/atividade";
import { gerarHashSenha, gerarSenhaProvisoria } from "@/lib/auth/senha";
import { exigirConsultor } from "@/lib/auth/sessao";
import { cpfValido, hojeBrasil } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { checkbox, cpfCampo, dadosDoForm, dataCampo, dataOpcional, moeda, numero, texto, textoOpcional } from "@/lib/formularios";

const esquemaCliente = z.object({
  nome: texto("o nome"),
  cpf: cpfCampo.refine(cpfValido, "CPF do cliente inválido."),
  telefone: textoOpcional,
  email: z.string().trim().toLowerCase().email("E-mail inválido.").optional().or(z.literal("")).transform((v) => v || null),
  endereco: textoOpcional,
  cidade: textoOpcional,
  uf: textoOpcional,
  cep: textoOpcional,
  inicioContrato: dataCampo("a data de início do contrato"),
  mensalidade: moeda("mensalidade"),
  diaVencimento: numero("dia de vencimento", 1, 28),
  plano: z.enum(["BASICO", "MEDIO", "PLUS"]).default("BASICO"),
  procuracaoStatus: z.enum(["PENDENTE", "ATIVA", "VENCIDA"]),
  procuracaoValidade: dataOpcional,
  observacoes: textoOpcional,
  ativo: checkbox,
});

export async function salvarCliente(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  const id = fd.get("id")?.toString() || null;
  let destino: string;
  try {
    const dados = esquemaCliente.parse(dadosDoForm(fd));
    if (dados.procuracaoStatus === "ATIVA" && !dados.procuracaoValidade) return { erro: "Informe a validade da procuração ativa." };
    if (id) {
      await prisma.cliente.update({ where: { id }, data: dados });
      await registrarAtividade({ usuarioId: u.id, clienteId: id, acao: "CLIENTE_ALTERADO", descricao: `Cadastro de ${dados.nome} alterado` });
      destino = `/consultor/clientes/${id}`;
    } else {
      const c = await prisma.cliente.create({ data: { ...dados, ativo: true } });
      await registrarAtividade({ usuarioId: u.id, clienteId: c.id, acao: "CLIENTE_CRIADO", descricao: `Cliente ${dados.nome} cadastrado` });
      destino = `/consultor/clientes/${c.id}`;
    }
  } catch (e) {
    return erroParaEstado(e);
  }
  revalidatePath("/consultor/clientes");
  redirect(destino);
}

/** Cria (ou recria a senha de) acesso do cliente ao portal. */
export async function criarAcessoCliente(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const clienteId = z.string().parse(fd.get("clienteId"));
    const email = z.string().trim().toLowerCase().email("Informe um e-mail válido.").parse(fd.get("email"));
    const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } });
    const senha = gerarSenhaProvisoria();
    const senhaHash = await gerarHashSenha(senha);
    const existente = await prisma.usuario.findFirst({ where: { clienteId, papel: "CLIENTE" } });
    const outro = await prisma.usuario.findUnique({ where: { email } });
    if (outro && outro.id !== existente?.id) return { erro: "Este e-mail já é usado por outro acesso." };
    if (existente) {
      await prisma.usuario.update({ where: { id: existente.id }, data: { email, senhaHash, trocarSenha: true, ativo: true, tentativasFalhas: 0, bloqueadoAte: null } });
    } else {
      await prisma.usuario.create({ data: { email, senhaHash, nome: cliente.nome, papel: "CLIENTE", clienteId, trocarSenha: true } });
    }
    await registrarAtividade({ usuarioId: u.id, clienteId, acao: "ACESSO_CLIENTE", descricao: `Acesso ao portal ${existente ? "redefinido" : "criado"} para ${email}` });
    revalidatePath(`/consultor/clientes/${clienteId}`);
    return { ok: true, mensagem: `Acesso pronto! E-mail: ${email} — senha provisória: ${senha} (anote e envie ao cliente; ela será trocada no primeiro acesso).` };
  } catch (e) {
    return erroParaEstado(e);
  }
}

export async function desativarAcesso(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  const usuarioId = String(fd.get("usuarioId"));
  const alvo = await prisma.usuario.update({ where: { id: usuarioId }, data: { ativo: false } });
  await registrarAtividade({ usuarioId: u.id, clienteId: alvo.clienteId, acao: "ACESSO_DESATIVADO", descricao: `Acesso de ${alvo.email} desativado` });
  revalidatePath("/consultor/clientes");
  return { ok: true, mensagem: "Acesso desativado." };
}

export async function registrarTempo(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const u = await exigirConsultor();
  try {
    const d = z.object({ clienteId: z.string(), tarefa: texto("a tarefa"), minutos: numero("minutos", 1, 1440), data: dataOpcional }).parse(dadosDoForm(fd));
    await prisma.registroTempo.create({ data: { clienteId: d.clienteId, tarefa: d.tarefa, minutos: d.minutos, data: d.data ?? hojeBrasil(), usuarioId: u.id } });
    revalidatePath(`/consultor/clientes/${d.clienteId}`);
    return { ok: true, mensagem: "Tempo registrado." };
  } catch (e) {
    return erroParaEstado(e);
  }
}
