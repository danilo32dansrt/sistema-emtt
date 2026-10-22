import { Formulario } from "@/components/Formulario";
import { AreaTexto, Campo, Cartao, Selecao, Selo } from "@/components/ui";
import { exigirEmpregado } from "@/lib/auth/sessao";
import { addDias, formatarData, hojeBrasil } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { ROTULO_MARCACAO } from "@/lib/ponto/registro";
import { enviarJustificativa, pedirAjuste } from "../acoes";

const COR = { PENDENTE: "amarelo", APROVADO: "verde", REJEITADO: "vermelho" } as const;

export default async function Justificativas({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  // Vindo do botão "Faltei — justificar": a data já vem preenchida
  const dataSugerida = /^\d{4}-\d{2}-\d{2}$/.test((await searchParams).data ?? "") ? (await searchParams).data : undefined;
  const u = await exigirEmpregado();
  const hoje = hojeBrasil();
  const [justificativas, ajustes, recentes] = await Promise.all([
    prisma.justificativa.findMany({ where: { empregadoId: u.empregadoId }, orderBy: { criadoEm: "desc" }, take: 20 }),
    prisma.ajustePonto.findMany({ where: { empregadoId: u.empregadoId }, orderBy: { criadoEm: "desc" }, take: 20 }),
    prisma.marcacaoPonto.findMany({ where: { empregadoId: u.empregadoId, dataHora: { gte: addDias(hoje, -15) } }, orderBy: { dataHora: "desc" } }),
  ]);
  return (
    <div className="space-y-4">
      <Cartao titulo="Justificar falta ou atraso">
        <Formulario acao={enviarJustificativa} textoBotao="Enviar justificativa" limparAoSalvar>
          <Selecao rotulo="Motivo" name="tipo" opcoes={[
            { valor: "ATESTADO_MEDICO", rotulo: "Atestado médico (anexe a foto)" },
            { valor: "CASAMENTO", rotulo: "Casamento (até 3 dias)" },
            { valor: "FALECIMENTO_FAMILIAR", rotulo: "Falecimento de familiar (até 2 dias)" },
            { valor: "DOACAO_SANGUE", rotulo: "Doação de sangue (1 dia por ano)" },
            { valor: "VIAGEM", rotulo: "Viagem de acompanhamento" },
            { valor: "FOLGA_COMPENSATORIA", rotulo: "Folga compensatória combinada" },
            { valor: "OUTRO", rotulo: "Outro" },
          ]} />
          <Campo rotulo="Data" name="data" type="date" required defaultValue={dataSugerida} />
          <Campo rotulo="Até (se mais de um dia)" name="dataFim" type="date" />
          <AreaTexto rotulo="Explique" name="descricao" required />
          <Campo rotulo="Comprovante (foto ou PDF)" name="anexo" type="file" accept="image/*,application/pdf" />
        </Formulario>
      </Cartao>
      <Cartao titulo="Esqueci de marcar / marquei errado">
        <Formulario acao={pedirAjuste} textoBotao="Pedir ajuste" limparAoSalvar>
          <Selecao rotulo="O que aconteceu?" name="tipo" opcoes={[{ valor: "INCLUSAO", rotulo: "Esqueci de marcar" }, { valor: "DESCONSIDERAR", rotulo: "Marquei errado (desconsiderar uma marcação)" }]} />
          <Campo rotulo="Data" name="data" type="date" required defaultValue={dataSugerida} />
          <Campo rotulo="Horário esquecido" name="hora" type="time" />
          <Selecao rotulo="Tipo da marcação esquecida" name="tipoMarcacao" opcoes={Object.entries(ROTULO_MARCACAO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
          <Selecao rotulo="Marcação errada (se for o caso)" name="marcacaoId" opcoes={[{ valor: "", rotulo: "—" }, ...recentes.map((m) => ({ valor: m.id, rotulo: `${ROTULO_MARCACAO[m.tipo]} — ${m.dataHora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` }))]} />
          <AreaTexto rotulo="Motivo" name="justificativa" required />
        </Formulario>
      </Cartao>
      <Cartao titulo="Meus pedidos">
        <ul className="space-y-2 text-sm">
          {justificativas.map((j) => <li key={j.id}><Selo cor={COR[j.status]}>{j.status.toLowerCase()}</Selo> {j.tipo.toLowerCase().replace(/_/g, " ")} — {formatarData(j.data)}{j.dataFim ? ` a ${formatarData(j.dataFim)}` : ""}</li>)}
          {ajustes.map((a) => <li key={a.id}><Selo cor={COR[a.status]}>{a.status.toLowerCase()}</Selo> ajuste ({a.tipo === "INCLUSAO" ? "inclusão" : "desconsiderar"}) — {formatarData(a.data)}{a.motivoDecisao ? ` · ${a.motivoDecisao}` : ""}</li>)}
          {!justificativas.length && !ajustes.length && <li className="text-slate-500">Nenhum pedido.</li>}
        </ul>
      </Cartao>
    </div>
  );
}
