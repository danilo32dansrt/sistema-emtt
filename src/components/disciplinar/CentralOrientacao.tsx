import { Aviso, Cartao, Titulo } from "../ui";

const SECOES = [
  {
    titulo: "Como conversar com a empregada",
    itens: [
      "Converse em particular, com calma, logo depois de saber do problema. Nunca na frente de outras pessoas.",
      "Fale do fato, não da pessoa: “ontem você chegou às 9h20” em vez de “você é irresponsável”.",
      "Ouça a versão dela até o fim. Às vezes há um motivo que você não conhecia.",
      "Combine o que deve mudar e registre a conversa no sistema (orientação verbal registrada).",
    ],
  },
  {
    titulo: "Como escrever uma advertência",
    itens: [
      "Descreva o fato com data, hora, local e o que aconteceu, de forma objetiva.",
      "Cite quem presenciou e guarde as provas (fotos, mensagens, registros de ponto).",
      "Não use adjetivos, ironia ou ameaças. Não misture vários fatos antigos numa só advertência.",
      "Entregue logo após o fato. A empregada assina apenas para dar ciência — se recusar, registre com 2 testemunhas.",
    ],
  },
  {
    titulo: "O que é proibido",
    itens: [
      "Multa em dinheiro ou desconto no salário como punição.",
      "Humilhar, gritar, expor a empregada (inclusive em grupos de WhatsApp ou redes sociais).",
      "Punir todos por causa de um (punição coletiva) ou punir duas vezes o mesmo fato.",
      "Reduzir o salário, rebaixar a função ou dar suspensão acima de 30 dias.",
      "Punir por motivo discriminatório (gravidez, religião, cor, idade, doença) ou por fato sem ligação com o trabalho.",
    ],
  },
  {
    titulo: "Quando chamar o consultor",
    itens: [
      "Sempre que pensar em justa causa — o sistema exige a revisão do consultor.",
      "Se a empregada estiver grávida, afastada, voltando de acidente ou de licença.",
      "Se houver salário, DAE ou férias em atraso: ela pode pedir rescisão indireta.",
      "Se a empregada sumir por muitos dias (possível abandono de emprego) ou se houver suspeita de furto ou maus-tratos.",
    ],
  },
  {
    titulo: "Boas práticas para evitar conflitos",
    itens: [
      "Deixe tudo combinado por escrito: horários, tarefas, regras da casa, uso do celular.",
      "Dê retorno com frequência, inclusive elogios. Problemas pequenos resolvidos cedo não viram grandes.",
      "Mantenha o ponto, o salário e o DAE sempre em dia — isso dá segurança aos dois lados.",
      "Use a gradação: orientação → advertência → suspensão → (só em último caso) justa causa.",
    ],
  },
];

export function CentralOrientacao() {
  return (
    <>
      <Titulo subtitulo="Orientações em linguagem simples para lidar com problemas no dia a dia.">Central de orientação disciplinar</Titulo>
      <div className="mb-4"><Aviso tipo="aviso">As recomendações são orientativas e não substituem análise de advogado em casos graves.</Aviso></div>
      <div className="grid gap-4 lg:grid-cols-2">
        {SECOES.map((s) => (
          <Cartao key={s.titulo} titulo={s.titulo}>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">{s.itens.map((i) => <li key={i}>{i}</li>)}</ul>
          </Cartao>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">Base legal: LC 150/2015, art. 27 (justa causa e rescisão indireta do doméstico) e art. 19 (aplicação subsidiária da CLT); CLT, art. 474 (suspensão de até 30 dias).</p>
    </>
  );
}
