"use client";

import { useActionState } from "react";
import type { Impacto } from "@/lib/servicos/parametros";
import { BotaoEnviar } from "@/components/Formulario";
import { Aviso } from "@/components/ui";
import { avisarClientes, salvarVigencia } from "./acoes";

/** Formulário de nova vigência que mostra quem é afetado e permite avisar os clientes. */
export function FormVigencia({ chave, children }: { chave: string; children: React.ReactNode }) {
  const [estado, acao] = useActionState(salvarVigencia, null);
  const [aviso, acaoAviso] = useActionState(avisarClientes, null);
  const resultado = estado?.ok ? (estado.dados as { impactos: Impacto[]; vigencia: string }) : null;
  return (
    <div className="space-y-3">
      <form action={acao} className="space-y-3">
        <input type="hidden" name="chave" value={chave} />
        {children}
        {estado?.erro && <Aviso tipo="critico">{estado.erro}</Aviso>}
        {estado?.ok && <Aviso tipo="sucesso">{estado.mensagem}</Aviso>}
        <BotaoEnviar variante="secundario" pequeno>Salvar vigência</BotaoEnviar>
      </form>
      {resultado && resultado.impactos.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-semibold">Clientes afetados</p>
          <ul className="mt-1 space-y-1">{resultado.impactos.map((i, n) => <li key={n}>{i.cliente} — {i.empregado}: {i.antes} → <strong>{i.depois}</strong></li>)}</ul>
          <form action={acaoAviso} className="mt-2">
            <input type="hidden" name="chave" value={chave} />
            <input type="hidden" name="vigenciaInicio" value={resultado.vigencia} />
            <BotaoEnviar pequeno>Avisar os clientes pelo chat</BotaoEnviar>
            {aviso?.ok && <span className="ml-2 text-emerald-700">{aviso.mensagem}</span>}
            {aviso?.erro && <span className="ml-2 text-red-700">{aviso.erro}</span>}
          </form>
        </div>
      )}
    </div>
  );
}
