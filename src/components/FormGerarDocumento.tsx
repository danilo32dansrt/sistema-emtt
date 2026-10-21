"use client";

import { useActionState, useState } from "react";
import { acaoGerarDocumento } from "@/app/acoes-documentos";
import { BotaoEnviar } from "./Formulario";
import { Aviso } from "./ui";

interface Opcoes {
  clientes: { id: string; nome: string }[];
  empregados: { id: string; nome: string; clienteId: string; ferias: { id: string; rotulo: string }[] }[];
  tipos: { valor: string; rotulo: string; empregado: boolean }[];
  inicial?: { clienteId?: string; empregadoId?: string };
}

const cls = "block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3";

export function FormGerarDocumento({ clientes, empregados, tipos, inicial }: Opcoes) {
  const [estado, acao] = useActionState(acaoGerarDocumento, null);
  const empInicial = empregados.find((e) => e.id === inicial?.empregadoId);
  const [clienteId, setClienteId] = useState(empInicial?.clienteId ?? inicial?.clienteId ?? clientes[0]?.id ?? "");
  const [empregadoId, setEmpregadoId] = useState(empInicial?.id ?? "");
  const [tipo, setTipo] = useState("CONTRATO_TRABALHO");
  const doCliente = empregados.filter((e) => e.clienteId === clienteId);
  const emp = empregados.find((e) => e.id === empregadoId);
  const precisaMes = ["FOLHA_PONTO", "ESPELHO_PONTO", "RECIBO_SALARIO"].includes(tipo);
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-medium">Cliente
        <select name="clienteId" value={clienteId} onChange={(e) => { setClienteId(e.target.value); setEmpregadoId(""); }} className={cls}>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Documento
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={cls}>
          {tipos.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
        </select>
      </label>
      {tipos.find((t) => t.valor === tipo)?.empregado && (
        <label className="block text-sm font-medium">Empregado
          <select name="empregadoId" value={empregadoId} onChange={(e) => setEmpregadoId(e.target.value)} className={cls} required>
            <option value="">— escolha —</option>
            {doCliente.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </label>
      )}
      {precisaMes && <label className="block text-sm font-medium">Mês<input type="month" name="competencia" defaultValue={mesAtual} className={cls} required /></label>}
      {(tipo === "AVISO_FERIAS" || tipo === "RECIBO_FERIAS") && (
        <label className="block text-sm font-medium">Férias registradas
          <select name="feriasId" className={cls} required>
            {(emp?.ferias ?? []).map((f) => <option key={f.id} value={f.id}>{f.rotulo}</option>)}
          </select>
          {emp && !emp.ferias.length && <span className="text-xs text-amber-700">Registre as férias na página do empregado.</span>}
        </label>
      )}
      {(tipo === "RECIBO_13" || tipo === "INFORME_RENDIMENTOS") && <label className="block text-sm font-medium">Ano<input type="number" name="ano" defaultValue={tipo === "INFORME_RENDIMENTOS" ? hoje.getFullYear() - 1 : hoje.getFullYear()} className={cls} /></label>}
      {tipo === "RECIBO_13" && <label className="block text-sm font-medium">Parcela<select name="parcela" className={cls}><option value="1">1ª parcela</option><option value="2">2ª parcela</option></select></label>}
      {tipo === "RECIBO_ADIANTAMENTO" && (
        <>
          <label className="block text-sm font-medium">Valor (R$)<input name="valor" inputMode="decimal" className={cls} required /></label>
          <label className="block text-sm font-medium">Data<input type="date" name="data" className={cls} required /></label>
        </>
      )}
      {tipo === "AVISO_PREVIO" && (
        <>
          <label className="block text-sm font-medium">Quem avisa<select name="quem" className={cls}><option value="EMPREGADOR">Empregador (dispensa)</option><option value="EMPREGADO">Empregado (pedido de demissão)</option></select></label>
          <label className="block text-sm font-medium">Modo<select name="modoAviso" className={cls}><option value="TRABALHADO">Trabalhado</option><option value="INDENIZADO">Indenizado</option><option value="DISPENSADO">Dispensa do cumprimento</option></select></label>
          <label className="block text-sm font-medium">Data do aviso<input type="date" name="data" className={cls} required /></label>
        </>
      )}
      <div className="sm:col-span-2 space-y-2">
        {estado?.erro && <Aviso tipo="critico">{estado.erro}</Aviso>}
        {estado?.ok && <Aviso tipo="sucesso">{estado.mensagem} <a className="font-semibold underline" target="_blank" href={`/api/documentos/${estado.dados}`}>Abrir PDF</a></Aviso>}
        <BotaoEnviar>Gerar PDF</BotaoEnviar>
      </div>
    </form>
  );
}
