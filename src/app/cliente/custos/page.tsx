import { Cartao, Celula, Indicador, Tabela, Titulo } from "@/components/ui";
import { exigirCliente } from "@/lib/auth/sessao";
import { formatarMoeda, hojeBrasil, nomeMes, provisaoMensal, somar } from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { folhaDoMes } from "@/lib/servicos/folha";
import { tabelaDoAno } from "@/lib/tabelas-db";

export const metadata = { title: "Painel de custos" };

export default async function Custos() {
  const u = await exigirCliente();
  const hoje = hojeBrasil();
  const ano = hoje.getUTCFullYear();
  const mesAtual = hoje.getUTCMonth() + 1;
  const empregados = await prisma.empregado.findMany({ where: { clienteId: u.clienteId }, include: { lancamentos: { where: { ano } }, competencias: { where: { ano } } } });
  const { tabela } = await tabelaDoAno(ano);

  const meses: { mes: number; total: number; porEmpregado: Record<string, number> }[] = [];
  for (let mes = 1; mes <= mesAtual; mes++) {
    const porEmpregado: Record<string, number> = {};
    for (const e of empregados) {
      const { folha } = await folhaDoMes(e, ano, mes, e.lancamentos.find((l) => l.mes === mes));
      if (!folha.diasTrabalhados) continue;
      porEmpregado[e.id] = somar(folha.totalProventos - folha.salarioFamilia, folha.encargos.custoEmpregador);
    }
    meses.push({ mes, porEmpregado, total: somar(...Object.values(porEmpregado)) });
  }
  const totalAno = somar(...meses.map((m) => m.total));
  const maior = Math.max(1, ...meses.map((m) => m.total));
  const ativos = empregados.filter((e) => e.situacao !== "DESLIGADO");
  const provisao = somar(...ativos.map((e) => provisaoMensal(num(e.salario), tabela).total));

  return (
    <>
      <Titulo subtitulo="Salários e encargos do empregador (DAE sem o INSS descontado do empregado). Estimativa com base nas informações enviadas.">Painel de custos {ano}</Titulo>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Indicador rotulo={`Gasto em ${nomeMes(mesAtual)}`} valor={formatarMoeda(meses.at(-1)?.total ?? 0)} />
        <Indicador rotulo={`Gasto no ano (até ${nomeMes(mesAtual)})`} valor={formatarMoeda(totalAno)} />
        <Indicador rotulo="Guardar por mês (13º, férias, rescisão)" valor={formatarMoeda(provisao)} cor="amarelo" />
      </div>
      <Cartao titulo="Gasto por mês" className="mb-4">
        <figure aria-label="Gráfico de barras do gasto mensal">
          <ul className="space-y-2">
            {meses.map((m) => (
              <li key={m.mes} className="grid grid-cols-[3.5rem_1fr_7rem] items-center gap-2 text-sm">
                <span className="capitalize text-slate-600">{nomeMes(m.mes).slice(0, 3)}</span>
                <span className="h-6 rounded-r-md bg-slate-100"><span className="block h-6 rounded-r-md bg-marca-500" style={{ width: `${(m.total / maior) * 100}%` }} /></span>
                <span className="text-right font-semibold tabular-nums">{formatarMoeda(m.total)}</span>
              </li>
            ))}
          </ul>
        </figure>
      </Cartao>
      <Cartao titulo="Por empregado">
        <Tabela cabecalho={["Empregado", "No ano", "Média mensal"]}>
          {empregados.map((e) => {
            const valores = meses.map((m) => m.porEmpregado[e.id]).filter((v) => v !== undefined);
            const soma = somar(...valores);
            return (
              <tr key={e.id}>
                <Celula>{e.nome}</Celula>
                <Celula className="tabular-nums">{formatarMoeda(soma)}</Celula>
                <Celula className="tabular-nums">{formatarMoeda(valores.length ? soma / valores.length : 0)}</Celula>
              </tr>
            );
          })}
        </Tabela>
      </Cartao>
    </>
  );
}
