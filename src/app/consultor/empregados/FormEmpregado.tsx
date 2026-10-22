import type { Cliente, Empregado } from "@prisma/client";
import { Formulario } from "@/components/Formulario";
import { AreaTexto, Campo, Grade, Marcador, Selecao } from "@/components/ui";
import { DIAS_SEMANA, formatarNumero, isoData, NOMES_DIAS_SEMANA, NOMES_REGIME } from "@/lib/calculos";
import { horariosDoEmpregado, jornadaDoEmpregado, num } from "@/lib/conversao";
import { salvarEmpregado } from "./acoes";

export const CBOS = [
  { codigo: "5121-05", nome: "Empregado doméstico nos serviços gerais" },
  { codigo: "5121-10", nome: "Empregado doméstico arrumador" },
  { codigo: "5121-15", nome: "Empregado doméstico faxineiro" },
  { codigo: "5132-10", nome: "Cozinheiro do serviço doméstico" },
  { codigo: "5162-05", nome: "Babá" },
  { codigo: "5162-10", nome: "Cuidador de idosos" },
  { codigo: "7823-05", nome: "Motorista de carro de passeio" },
  { codigo: "6220-10", nome: "Jardineiro" },
];

export function FormEmpregado({ empregado, clientes, clienteId }: { empregado?: Empregado; clientes: Pick<Cliente, "id" | "nome">[]; clienteId?: string }) {
  const jornada = empregado ? jornadaDoEmpregado(empregado) : { seg: 8, ter: 8, qua: 8, qui: 8, sex: 8, sab: 4 };
  const horarios = empregado ? horariosDoEmpregado(empregado) ?? {} : {};
  return (
    <Formulario acao={salvarEmpregado} textoBotao={empregado ? "Salvar alterações" : "Cadastrar empregado"}>
      {empregado && <input type="hidden" name="id" value={empregado.id} />}
      <h3 className="font-semibold text-slate-800">Dados pessoais</h3>
      <Grade>
        <Selecao rotulo="Empregador (cliente)" name="clienteId" defaultValue={empregado?.clienteId ?? clienteId} opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
        <Campo rotulo="Nome completo" name="nome" required defaultValue={empregado?.nome} />
        <Campo rotulo="CPF" name="cpf" required inputMode="numeric" defaultValue={empregado?.cpf} />
        <Campo rotulo="Data de nascimento" name="nascimento" type="date" defaultValue={isoData(empregado?.nascimento)} />
        <Campo rotulo="Telefone" name="telefone" inputMode="tel" defaultValue={empregado?.telefone ?? ""} />
      </Grade>

      <h3 className="pt-2 font-semibold text-slate-800">Contrato</h3>
      <Grade>
        <Campo rotulo="Função" name="funcao" required defaultValue={empregado?.funcao ?? "Empregada doméstica"} />
        <div>
          <Campo rotulo="CBO" name="cbo" required list="lista-cbo" defaultValue={empregado?.cbo ?? "5121-05"} ajuda="5121-05 Serviços gerais · 5162-05 Babá · 5162-10 Cuidador" />
          <datalist id="lista-cbo">{CBOS.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}</datalist>
        </div>
        <Campo rotulo="Data de admissão" name="admissao" type="date" required defaultValue={isoData(empregado?.admissao)} />
        <Campo rotulo="Salário mensal (R$)" name="salario" inputMode="decimal" required defaultValue={empregado ? formatarNumero(num(empregado.salario)) : ""} />
        <Selecao rotulo="Regime" name="regime" defaultValue={empregado?.regime ?? "INTEGRAL"} opcoes={Object.entries(NOMES_REGIME).map(([valor, rotulo]) => ({ valor, rotulo }))} />
        <Campo rotulo="Contrato de experiência (dias)" name="diasExperiencia" type="number" min={1} max={90} defaultValue={empregado?.diasExperiencia ?? ""} ajuda="Deixe vazio se não houver. Máximo 90 dias." />
      </Grade>

      <h3 className="pt-2 font-semibold text-slate-800">Jornada por dia da semana</h3>
      <p className="text-sm text-slate-600">Informe as horas trabalhadas em cada dia (sem o intervalo). Os horários de entrada e saída são opcionais e servem para a tolerância do ponto.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="rounded-xl border border-slate-200 p-3">
            <p className="mb-1 text-sm font-semibold">{NOMES_DIAS_SEMANA[d]}</p>
            <input name={`horas_${d}`} inputMode="decimal" placeholder="horas" defaultValue={jornada[d] ? String(jornada[d]).replace(".", ",") : ""} className="mb-1 min-h-11 w-full rounded-lg border border-slate-300 px-2" aria-label={`Horas de ${NOMES_DIAS_SEMANA[d]}`} />
            <div className="flex gap-1">
              <input type="time" name={`entrada_${d}`} defaultValue={horarios?.[d]?.entrada ?? ""} className="min-h-10 w-1/2 rounded-lg border border-slate-300 px-1 text-sm" aria-label={`Entrada ${NOMES_DIAS_SEMANA[d]}`} />
              <input type="time" name={`saida_${d}`} defaultValue={horarios?.[d]?.saida ?? ""} className="min-h-10 w-1/2 rounded-lg border border-slate-300 px-1 text-sm" aria-label={`Saída ${NOMES_DIAS_SEMANA[d]}`} />
            </div>
          </div>
        ))}
      </div>
      <Grade>
        <Campo rotulo="Tolerância por marcação (minutos)" name="toleranciaMinutos" type="number" min={0} max={5} defaultValue={empregado?.toleranciaMinutos ?? 5} ajuda="CLT art. 58, § 1º: até 5 min por marcação, 10 min no dia." />
        <Campo rotulo="Início da escala 12x36" name="referencia12x36" type="date" defaultValue={isoData(empregado?.referencia12x36)} ajuda="Só para 12x36: primeiro dia trabalhado da escala." />
      </Grade>

      <h3 className="pt-2 font-semibold text-slate-800">Acordos escritos</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <Marcador rotulo="Acordo de compensação / banco de horas (art. 2º, § 5º)" name="acordoCompensacao" defaultChecked={empregado?.acordoCompensacao} />
        <Marcador rotulo="Intervalo reduzido para 30 minutos (art. 13)" name="acordoIntervaloReduzido" defaultChecked={empregado?.acordoIntervaloReduzido} />
        <Marcador rotulo="Escala 12x36 (art. 10)" name="acordo12x36" defaultChecked={empregado?.acordo12x36} />
        <Marcador rotulo="Acompanhamento em viagem (art. 11)" name="acordoViagem" defaultChecked={empregado?.acordoViagem} />
        <Marcador rotulo="Reside no local de trabalho" name="residenteNoLocal" defaultChecked={empregado?.residenteNoLocal} />
      </div>

      <h3 className="pt-2 font-semibold text-slate-800">Benefícios e estabilidade</h3>
      <Grade>
        <Campo rotulo="Filhos até 14 anos (salário-família)" name="dependentesSalarioFamilia" type="number" min={0} defaultValue={empregado?.dependentesSalarioFamilia ?? 0} />
        <Campo rotulo="Custo mensal do vale-transporte (R$)" name="custoValeTransporte" inputMode="decimal" defaultValue={empregado?.custoValeTransporte ? formatarNumero(num(empregado.custoValeTransporte)) : ""} ajuda="Desconto de até 6% do salário." />
      </Grade>
      <div className="grid gap-2 sm:grid-cols-2">
        <Marcador rotulo="Gestante" name="gestante" defaultChecked={empregado?.gestante} />
        <Campo rotulo="Data prevista do parto" name="dataPrevistaParto" type="date" defaultValue={isoData(empregado?.dataPrevistaParto)} />
        <Campo rotulo="Estabilidade até" name="estabilidadeAte" type="date" defaultValue={isoData(empregado?.estabilidadeAte)} ajuda="Gestante: calculada automaticamente (5 meses após o parto)." />
        <Campo rotulo="Motivo da estabilidade" name="estabilidadeMotivo" defaultValue={empregado?.estabilidadeMotivo ?? ""} />
      </div>

      <h3 className="pt-2 font-semibold text-slate-800">Aplicativo de ponto</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <Marcador rotulo="Usar ponto eletrônico" name="pontoAtivo" defaultChecked={empregado?.pontoAtivo} />
        <Marcador rotulo="Exigir selfie na marcação (opcional — o padrão é o GPS da casa)" name="exigirSelfie" defaultChecked={empregado?.exigirSelfie ?? false} />
        <Marcador rotulo="Registrar localização na marcação" name="exigirLocalizacao" defaultChecked={empregado?.exigirLocalizacao ?? true} />
      </div>
      <AreaTexto rotulo="Observações" name="observacoes" defaultValue={empregado?.observacoes ?? ""} />
    </Formulario>
  );
}
