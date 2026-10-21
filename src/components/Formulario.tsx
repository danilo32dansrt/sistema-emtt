"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { EstadoAcao } from "@/lib/acoes";
import { Aviso, Botao, cx, type VarianteBotao } from "./ui";

type Acao = (estado: EstadoAcao, dados: FormData) => Promise<EstadoAcao>;

export function BotaoEnviar({ children, variante = "primario", pequeno, className, confirmar }: { children: ReactNode; variante?: VarianteBotao; pequeno?: boolean; className?: string; confirmar?: string }) {
  const { pending } = useFormStatus();
  return (
    <Botao
      type="submit"
      variante={variante}
      pequeno={pequeno}
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {pending ? "Aguarde..." : children}
    </Botao>
  );
}

/** Formulário ligado a uma Server Action, mostrando erro/sucesso sem recarregar a página. */
export function Formulario({
  acao,
  children,
  textoBotao = "Salvar",
  variante = "primario",
  className,
  limparAoSalvar,
  confirmar,
  semBotao,
  pequeno,
}: {
  acao: Acao;
  children?: ReactNode;
  textoBotao?: ReactNode;
  variante?: VarianteBotao;
  className?: string;
  limparAoSalvar?: boolean;
  confirmar?: string;
  semBotao?: boolean;
  pequeno?: boolean;
}) {
  const [estado, formAction] = useActionState(acao, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok && limparAoSalvar) ref.current?.reset();
  }, [estado, limparAoSalvar]);

  return (
    <form ref={ref} action={formAction} className={cx("space-y-4", className)}>
      {children}
      {estado?.erro && <Aviso tipo="critico">{estado.erro}</Aviso>}
      {estado?.ok && estado.mensagem && <Aviso tipo="sucesso">{estado.mensagem}</Aviso>}
      {!semBotao && (
        <BotaoEnviar variante={variante} confirmar={confirmar} pequeno={pequeno}>
          {textoBotao}
        </BotaoEnviar>
      )}
    </form>
  );
}

/** Botão único que dispara uma ação (ex.: marcar etapa, excluir). */
export function BotaoAcao({ acao, campos, children, variante = "secundario", confirmar, pequeno = true }: { acao: Acao; campos?: Record<string, string>; children: ReactNode; variante?: VarianteBotao; confirmar?: string; pequeno?: boolean }) {
  const [estado, formAction] = useActionState(acao, null);
  return (
    <form action={formAction} className="inline-block">
      {Object.entries(campos ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <BotaoEnviar variante={variante} pequeno={pequeno} confirmar={confirmar}>
        {children}
      </BotaoEnviar>
      {estado?.erro && <span className="ml-2 text-xs text-red-700">{estado.erro}</span>}
      {estado?.ok && estado.mensagem && <span className="ml-2 text-xs text-emerald-700">{estado.mensagem}</span>}
    </form>
  );
}
