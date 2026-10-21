import { Formulario } from "@/components/Formulario";
import { AreaTexto, Aviso, Campo, Cartao, Grade, Titulo } from "@/components/ui";
import { exigirCliente } from "@/lib/auth/sessao";
import { formatarCompetencia, formatarData, formatarNumero, hojeBrasil, nomeMes, prazosChecklist } from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { lerCompetencia } from "@/lib/servicos/competencia";
import { informarMes } from "../acoes";

export const metadata = { title: "Informar o mês" };

export default async function Informar({ searchParams }: { searchParams: Promise<{ ano?: string; mes?: string }> }) {
  const u = await exigirCliente();
  const sp = await searchParams;
  const hoje = hojeBrasil();
  const { ano, mes } = sp.ano ? lerCompetencia(sp) : { ano: hoje.getUTCFullYear(), mes: hoje.getUTCMonth() + 1 };
  const empregados = await prisma.empregado.findMany({ where: { clienteId: u.clienteId, situacao: { not: "DESLIGADO" } }, include: { lancamentos: { where: { ano, mes } }, competencias: { where: { ano, mes } } } });
  const prazo = prazosChecklist(ano, mes).infoRecebida;
  return (
    <>
      <Titulo subtitulo={`Envie até ${formatarData(prazo)}. Se não houve nada diferente, envie mesmo assim com tudo zerado.`}>Informações de {nomeMes(mes)}/{ano}</Titulo>
      <div className="space-y-4">
        {empregados.map((e) => {
          const l = e.lancamentos[0];
          const encerrada = e.competencias[0]?.folhaEncerrada;
          return (
            <Cartao key={e.id} titulo={e.nome}>
              {e.pontoAtivo && <div className="mb-3"><Aviso>{e.nome.split(" ")[0]} usa o aplicativo de ponto: faltas e horas extras já são calculadas automaticamente. Use este formulário só para adiantamentos e observações.</Aviso></div>}
              {l && <div className="mb-3"><Aviso tipo="sucesso">Enviado em {l.enviadoEm.toLocaleDateString("pt-BR")}. Você pode corrigir e enviar de novo até a folha ser encerrada.</Aviso></div>}
              {encerrada ? <Aviso tipo="aviso">A folha de {formatarCompetencia(ano, mes)} já foi encerrada.</Aviso> : (
                <Formulario acao={informarMes} textoBotao="Enviar ao consultor">
                  <input type="hidden" name="empregadoId" value={e.id} />
                  <input type="hidden" name="ano" value={ano} />
                  <input type="hidden" name="mes" value={mes} />
                  <Campo rotulo="Dias de falta sem justificativa" name="datasFaltas" placeholder="Ex.: 05/03, 12/03 (deixe vazio se não houve)" ajuda="Informe as datas. Falta sem justificativa desconta o dia e o descanso da semana." />
                  <Grade>
                    <Campo rotulo="Faltas com atestado/justificadas (dias)" name="faltasJustificadas" type="number" min={0} defaultValue={l?.faltasJustificadas ?? 0} />
                    <Campo rotulo="Atrasos no mês (minutos)" name="atrasoMinutos" type="number" min={0} defaultValue={l?.atrasoMinutos ?? 0} />
                    <Campo rotulo="Horas extras em dias normais" name="horasExtras50" inputMode="decimal" defaultValue={l ? formatarNumero(num(l.horasExtras50)) : "0"} />
                    <Campo rotulo="Horas em domingos/feriados (não folgados)" name="horasExtras100" inputMode="decimal" defaultValue={l ? formatarNumero(num(l.horasExtras100)) : "0"} />
                    <Campo rotulo="Horas trabalhadas entre 22h e 5h" name="horasNoturnas" inputMode="decimal" defaultValue={l ? formatarNumero(num(l.horasNoturnas)) : "0"} />
                    <Campo rotulo="Adiantamento pago no mês (R$)" name="adiantamento" inputMode="decimal" defaultValue={l ? formatarNumero(num(l.adiantamento)) : "0"} />
                  </Grade>
                  <AreaTexto rotulo="Observações (afastamentos, mudanças, dúvidas)" name="observacoes" />
                </Formulario>
              )}
            </Cartao>
          );
        })}
      </div>
    </>
  );
}
