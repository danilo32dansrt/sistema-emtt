import { registrarOcorrencia } from "@/app/acoes-disciplinar";
import { Formulario } from "../Formulario";
import { AreaTexto, Aviso, Campo, Grade, Selecao } from "../ui";
import { TIPOS_FALTA } from "@/lib/calculos";

/** Passos 1 e 2 do assistente: registrar os fatos e classificar a falta. */
export function FormNovaOcorrencia({ empregados, empregadoId }: { empregados: { id: string; nome: string }[]; empregadoId?: string }) {
  return (
    <Formulario acao={registrarOcorrencia} textoBotao="Registrar e ver a recomendação">
      <h3 className="text-lg font-semibold">1. O que aconteceu</h3>
      <Aviso titulo="Dica: escreva fatos, não opiniões">
        Em vez de “ela é preguiçosa”, escreva “no dia 10/03 chegou às 9h20 (horário 8h) e não avisou”. Diga quem, o quê, quando, onde e quem viu.
      </Aviso>
      <Grade>
        <Selecao rotulo="Empregado(a)" name="empregadoId" defaultValue={empregadoId} opcoes={empregados.map((e) => ({ valor: e.id, rotulo: e.nome }))} />
        <Campo rotulo="Data do fato" name="dataFato" type="date" required />
        <Campo rotulo="Hora (aproximada)" name="horaFato" type="time" />
        <Campo rotulo="Local" name="local" placeholder="Ex.: cozinha, quarto da criança" />
        <Campo rotulo="Quando você soube do fato" name="dataCiencia" type="date" required ajuda="Conta o prazo para agir (imediatidade)." />
      </Grade>
      <AreaTexto rotulo="Descrição objetiva do fato" name="descricao" rows={5} required minLength={20} />
      <AreaTexto rotulo="Testemunhas (nome e contato)" name="testemunhas" rows={2} />
      <Campo rotulo="Provas (fotos, prints de mensagens, documentos — até 5 MB cada)" name="provas" type="file" multiple accept="image/*,application/pdf" />
      <h3 className="pt-2 text-lg font-semibold">2. Tipo de falta</h3>
      <Selecao rotulo="Classificação" name="tipoFalta" opcoes={TIPOS_FALTA.map((t) => ({ valor: t.codigo, rotulo: `${t.rotulo} (${t.gravidade === "gravissima" ? "gravíssima" : t.gravidade === "media" ? "média" : t.gravidade})` }))} />
      <Selecao rotulo="Gravidade neste caso" name="gravidade" opcoes={[{ valor: "", rotulo: "Usar a gravidade padrão do tipo" }, { valor: "leve", rotulo: "Leve" }, { valor: "media", rotulo: "Média" }, { valor: "grave", rotulo: "Grave" }, { valor: "gravissima", rotulo: "Gravíssima" }]} ajuda="Ajuste só se o caso for claramente mais ou menos grave que o normal." />
    </Formulario>
  );
}
