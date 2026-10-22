import type { Cliente } from "@prisma/client";
import { Formulario } from "@/components/Formulario";
import { AreaTexto, Campo, Grade, Marcador, Selecao } from "@/components/ui";
import { formatarNumero, isoData } from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { PLANOS } from "@/lib/inter/plus";
import { salvarCliente } from "./acoes";

export function FormCliente({ cliente }: { cliente?: Cliente }) {
  return (
    <Formulario acao={salvarCliente} textoBotao={cliente ? "Salvar alterações" : "Cadastrar cliente"}>
      {cliente && <input type="hidden" name="id" value={cliente.id} />}
      <Grade>
        <Campo rotulo="Nome do empregador" name="nome" required defaultValue={cliente?.nome} />
        <Campo rotulo="CPF" name="cpf" required inputMode="numeric" placeholder="000.000.000-00" defaultValue={cliente?.cpf} />
        <Campo rotulo="Telefone / WhatsApp" name="telefone" inputMode="tel" placeholder="(11) 98765-4321" defaultValue={cliente?.telefone ?? ""} />
        <Campo rotulo="E-mail" name="email" type="email" defaultValue={cliente?.email ?? ""} />
        <Campo rotulo="Endereço" name="endereco" defaultValue={cliente?.endereco ?? ""} className="sm:col-span-2" />
        <Campo rotulo="Cidade" name="cidade" defaultValue={cliente?.cidade ?? ""} />
        <Grade>
          <Campo rotulo="UF" name="uf" maxLength={2} defaultValue={cliente?.uf ?? ""} />
          <Campo rotulo="CEP" name="cep" inputMode="numeric" defaultValue={cliente?.cep ?? ""} />
        </Grade>
        <Campo rotulo="Início do contrato de consultoria" name="inicioContrato" type="date" required defaultValue={isoData(cliente?.inicioContrato)} />
        <Grade>
          <Selecao rotulo="Plano" name="plano" defaultValue={cliente?.plano ?? "BASICO"} opcoes={(Object.keys(PLANOS) as (keyof typeof PLANOS)[]).map((k) => ({ valor: k, rotulo: `${PLANOS[k].nome} — ${PLANOS[k].resumo}` }))} ajuda="No Plus a cobrança do mês junta mensalidade + DAE e a consultoria paga o DAE pelo cliente." />
          <Campo rotulo="Mensalidade (R$)" name="mensalidade" inputMode="decimal" required defaultValue={cliente ? formatarNumero(num(cliente.mensalidade)) : ""} />
          <Campo rotulo="Dia de vencimento" name="diaVencimento" type="number" min={1} max={28} required defaultValue={cliente?.diaVencimento ?? 10} />
        </Grade>
        <Selecao
          rotulo="Procuração eletrônica"
          name="procuracaoStatus"
          defaultValue={cliente?.procuracaoStatus ?? "PENDENTE"}
          opcoes={[
            { valor: "PENDENTE", rotulo: "Pendente" },
            { valor: "ATIVA", rotulo: "Ativa" },
            { valor: "VENCIDA", rotulo: "Vencida" },
          ]}
        />
        <Campo rotulo="Validade da procuração" name="procuracaoValidade" type="date" defaultValue={isoData(cliente?.procuracaoValidade)} />
      </Grade>
      <AreaTexto rotulo="Observações" name="observacoes" defaultValue={cliente?.observacoes ?? ""} />
      {cliente && <Marcador rotulo="Cliente ativo" name="ativo" defaultChecked={cliente.ativo} />}
      {!cliente && <input type="hidden" name="ativo" value="on" />}
    </Formulario>
  );
}
