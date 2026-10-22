# Sistema de Gestão para Consultoria de eSocial Doméstico

Você é um desenvolvedor sênior especializado em sistemas de departamento pessoal brasileiros. Este
repositório contém um **sistema web completo** para uma consultoria que presta serviço de eSocial
Doméstico para vários empregadores. Tudo em **português do Brasil**, simples de usar, bom no celular,
com três acessos: **Consultor (administrador)**, **Cliente (empregador doméstico)** e **Empregado** (app de ponto).

## Stack definida
- Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- PostgreSQL (Supabase recomendado) via Prisma; Row Level Security ligada em todas as tabelas
  (a API pública do Supabase não lê nada; o acesso é só pelo servidor, filtrando pelo cliente logado)
- Autenticação própria: senha com bcrypt, sessão JWT (jose) em cookie httpOnly, bloqueio após 5 tentativas
- Arquivos (PDFs, comprovantes, selfies) guardados no banco (tabela `Arquivo`, até 5 MB) — funciona na Vercel
- PWA (aplicativo instalável) para o ponto do empregado, com funcionamento offline
- PDFs gerados no servidor com `pdf-lib`
- Testes automáticos (Vitest) obrigatórios para TODOS os cálculos trabalhistas
- Hospedagem: Vercel (com Cron diário em `vercel.json`)

## Regras de trabalho
- Trabalhe em etapas pequenas e mostre o resultado de cada uma antes de seguir.
- Explique em linguagem simples (o dono do projeto não é programador).
- Nunca coloque senhas ou chaves no código; use o arquivo `.env` (modelo em `.env.example`).
- Faça commit no Git ao fim de cada etapa concluída.
- Todos os valores legais ficam na tabela única de parâmetros (tela "Parâmetros legais"), com data de vigência — nunca fixos no código.
- Quando tiver dúvida sobre uma regra da legislação, pergunte em vez de supor.

## Comandos
- `npm run dev` — sistema em http://localhost:3000
- `npm test` — testes dos cálculos (rodar sempre antes de commit)
- `npm run typecheck` e `npm run lint`
- `npm run db:migrate` (desenvolvimento) / `npm run db:deploy` (produção) / `npm run db:seed` (tabelas + exemplos)

## Organização do código
- `src/lib/calculos/` — **núcleo de cálculos puro** (sem banco), com testes em `__tests__/`:
  dinheiro, datas/feriados, INSS, encargos do DAE, folha, 13º, férias, rescisão, regularização,
  validações, agenda de alertas, checklist, ponto (jornada), simuladores, diagnóstico, disciplinar,
  parâmetros com vigência (`parametros.ts`, valores iniciais em `parametros-padrao.ts`) e benefícios sociais.
- `src/lib/servicos/` — junta banco + cálculos (agenda, espelho de ponto, documentos, diagnóstico, disciplinar).
- `src/lib/pdf/` — modelos de documentos em PDF.
- `src/app/consultor`, `src/app/cliente`, `src/app/ponto` — telas de cada perfil; `src/app/api` — rotas.
- `prisma/schema.prisma` + `prisma/migrations` — banco. Marcações de ponto e assinaturas têm gatilho que impede alteração.

## Valores reais para validar (conferidos com o eSocial)
Empregada em tempo parcial de 22h semanais, salário R$ 810,50, admitida em 09/02/2026:
- Fevereiro/2026: proporcional R$ 578,93, INSS R$ 43,41, líquido R$ 535,52, DAE R$ 159,18 (o eSocial **trunca** cada parcela do DAE).
- Mês cheio: INSS R$ 60,78, líquido R$ 749,72, DAE R$ 222,89.
  Salário-família: o direito é verificado pela remuneração do mês inteiro, mesmo em mês de admissão/desligamento
  (Portaria Interministerial MPS/MF nº 13/2026); a cota paga é proporcional aos dias.
  **Pendência:** truncando, o sistema obtém R$ 222,87 (2 centavos de diferença). Nenhuma regra única de
  arredondamento reproduz os dois DAEs; aguardando a guia discriminada do eSocial (ver `it.todo` em `caso-real.test.ts`).

---

## 1. Contexto do negócio
- O consultor atende empregadores domésticos por procuração eletrônica no eSocial.
- Serviços: cadastro e admissão, regularização de períodos atrasados, folha mensal, DAE, recibos, férias, 13º e rescisão.
- O sistema **não** se integra ao eSocial: organiza, calcula, lembra e documenta. Lançamentos oficiais continuam no portal do eSocial.
- Base legal: Lei Complementar nº 150/2015.

## 2. Módulos do Consultor
- **2.1 Clientes:** nome, CPF, telefone/WhatsApp, e-mail, endereço, início do contrato, mensalidade, dia de vencimento, procuração (pendente/ativa/vencida + validade), observações.
- **2.2 Empregados:** nome, CPF, nascimento, função e CBO, admissão, salário, regime (integral 44h / parcial até 25h / 12x36), jornada por dia da semana, situação, vínculo com o cliente.
  Validações: salário abaixo do mínimo proporcional (mínimo ÷ 220 × horas semanais × 5); parcial acima de 25h/semana ou 6h/dia; 2 dias ou menos por semana (diarista).
- **2.3 Calculadora (com memória de cálculo):** DAE (INSS progressivo, patronal 8%, GILRAT 0,8%, FGTS 8%, compensatório 3,2%); salário proporcional; hora, extra 50%, faltas com DSR; 13º (avos ≥15 dias, 1ª até 30/11 sem INSS, 2ª até 20/12); férias (aquisitivo/concessivo, 1/3, abono, até 2 períodos, um ≥14 dias); rescisão por tipo (sem justa causa, pedido, justa causa, término, acordo, falecimento) com aviso 30+3/ano até 90, projeção, destino do FGTS compensatório e prazo de 10 dias; regularização (multa 0,33%/dia até 20% + Selic).
- **2.4 Rotina mensal (checklist):** informações recebidas, folha lançada, folha encerrada, DAE emitido (valor e código), DAE e recibo enviados, pagamento confirmado, recibo assinado arquivado. Contadores e destaque em vermelho para atrasos (DAE vence dia 7 ou dia útil anterior).
- **2.5 Agenda e alertas automáticos:** DAE (dia 7); 13º (30/11 e 20/12); férias (60 dias antes do fim do aquisitivo e alerta forte 60 dias antes do fim do concessivo); aviso de férias 30 dias antes e pagamento 2 dias antes; fim da experiência; vencimento da procuração; aniversário de admissão (+3 dias de aviso).
- **2.6 Documentos (PDF):** contrato de trabalho (integral, parcial, experiência); folha de ponto; aviso e recibo de férias; aviso prévio (empregador/empregado); recibo de 13º e de adiantamento; contrato de prestação de serviços consultor–cliente (cliente envia informações até dia 30 e paga o DAE no prazo; consultor emite guias até dia 4).
- **2.7 Financeiro:** mensalidades (valor, vencimento, pago/aberto, forma), serviços avulsos, relatório mensal de faturamento e inadimplência, tabela de preços.
- **2.7.1 Cobrança automática (Banco Inter PJ):** API Cobrança v3 (boleto com Pix) com certificado (mTLS) — `src/lib/inter/`
  (regras puras + testes; cliente HTTP), `src/lib/servicos/cobranca-inter.ts`, webhook `/api/inter/webhook?token=…` (só dispara
  a consulta ao banco; nunca confiar no corpo do aviso) e conferência diária no cron. Credenciais `INTER_*` só no `.env`.
  Cartão de crédito não existe na API do Inter: baixa manual.
- **2.7.2 Planos (Básico / Médio / Plus):** plano no cadastro do cliente; preços e dia do Plus em Configurações.
  Plus = cobrança única (mensalidade + DAEs da competência anterior, só emitida com todos os DAEs prontos, vencimento
  antes do DAE) e a consultoria paga o DAE por conta e ordem do cliente (`PagamentoDae`; API Banking do Inter
  `/banking/v2/pagamento` com código de barras, ou baixa manual). Nunca pagar DAE sem o dinheiro do cliente.
  Regras puras em `src/lib/inter/plus.ts`; serviço `src/lib/servicos/plano-plus.ts`.
- **2.8 Comunicação:** botão de WhatsApp com mensagem pronta e modelos (informações do mês, DAE, mensalidade, férias, 13º).

## 3. Portal do Cliente
Empregados e status do mês; baixar DAEs, recibos e documentos; informar faltas, extras e adiantamentos; marcar "DAE pago" com comprovante; próximos compromissos; ver e pagar a mensalidade.

## 4. Requisitos técnicos
Interface limpa, botões grandes, boa leitura no celular; login separado e cada cliente vê **apenas os seus dados**;
LGPD (senhas criptografadas, CPF mascarado nas listagens, registro de acessos, exclusão a pedido); backup e exportação em planilha;
valores em reais com 2 casas e datas dd/mm/aaaa.

### 4.1 Aplicativo de ponto (terceiro acesso: Empregado)
- Base legal: LC 150, art. 12 (registro obrigatório); Portaria MTP 671/2021 (REP-P) como padrão de idoneidade —
  marcações inalteráveis (correção só por ajuste justificado mantendo a original), comprovante de cada marcação,
  AFD e AEJ, espelho mensal e assinatura eletrônica. **Para comercializar como REP-P: registro no INPI, atestado técnico e termo de responsabilidade.**
- CLT subsidiária: tolerância 5 min por marcação / 10 min por dia; faltas justificadas (art. 473); intervalo de 15 min para jornadas de 4h a 6h.
- LGPD: selfie, biometria e geolocalização só no momento da marcação, nunca rastreamento; informar a finalidade e registrar a ciência.
- Guarda dos registros por pelo menos 5 anos, com acesso garantido ao empregado.
- Regimes: integral (8h/44h); parcial (25h, extra de 1h/dia com acordo, até 6h/dia); 12x36 (acordo escrito; feriados e DSR compensados); viagem (adicional mínimo de 25%); experiência até 90 dias.
- Cálculos: extra 50%; domingo/feriado não compensado em dobro; banco de horas (40h pagas no mês salvo compensação; excedente compensável em 1 ano; só com acordo); intervalo 1h–2h (30 min com acordo; fracionável para quem reside) e intervalo suprimido pago com 50%; interjornada 11h; DSR 24h; noturno 22h–5h com hora de 52min30s e adicional de 20%; faltas descontam também o DSR; justificadas com comprovante não descontam; bloquear/alertar limites do regime.
- **Banco de horas por regime (decidido com o dono):** INTEGRAL com acordo escrito — horas a menos no mês (atrasos, saídas
  antecipadas, dias marcados "compensar") abatem das extras do mês hora por hora (art. 2º, § 5º, II); 40 primeiras pagas;
  excedente no banco por 1 ano; o que ficar devendo no fim do mês é descontado (sem dívida para o mês seguinte nem para a
  rescisão). TEMPO PARCIAL e 12x36 — sem compensação (a LC 150, art. 3º, § 2º, não remete aos §§ 4º e 5º do art. 2º): hora a
  menos é descontada ou abonada; hora a mais paga com 50% (parcial: até 1h/dia e 6h no dia). Ausências têm tratamento
  ABONAR / COMPENSAR / DESCONTAR. Limites na tabela de parâmetros (grupo "Jornada e banco de horas").
- Fluxo: empregado marca (selfie + localização, offline com horário real); sistema calcula diariamente; empregador aprova ou pede ajuste (nunca apaga); espelho no fim do mês assinado pelos dois; consultor recebe o resumo em reais por rubrica.
- **Avisos no celular:** consultor, patrão e empregada usam PWA instalável (manifestos `/manifest-consultor.webmanifest`,
  `/manifest-cliente.webmanifest` e `/manifest.webmanifest`). Pendências repetem a cada hora até serem resolvidas
  (horário comercial para dias anteriores e pedidos) e aparecem na tela inicial com o botão que resolve. Web Push (VAPID no `.env`), tabelas `Notificacao` (chave única = não repete)
  e `InscricaoPush`; regras puras em `calculos/lembretes.ts`; rotina `/api/cron/lembretes` a cada 10 min (agendador externo)
  e lembretes de DAE/pedidos no cron diário; avisos imediatos em pedidos de ajuste/justificativa e nas decisões.
- **Pendências de um toque (sem formulário):** cada pendência traz os botões que a resolvem (`src/app/acoes-pendencias.ts`):
  patrão — "trabalhou no horário normal" (lança o horário do contrato com intervalo, como ajuste aprovado), "faltou —
  descontar", "abonar", "compensar" (só integral com acordo), "saiu no horário normal", aprovar/recusar pedidos e
  "confirmar o mês" (fecha o mês pelo ponto, com adiantamento opcional); empregada — "trabalhei no meu horário" /
  "saí às HH:MM" (pedido ao patrão) e "faltei — justificar". Decisões em `TratamentoDia`; nada é apagado e o outro
  lado é avisado. **Decidido com o dono: sem botão "discordo" — parte-se do princípio de que todos informam o real;
  o que o patrão lança passa a valer e os avisos à empregada são só informativos.** Mês sem nenhuma marcação não é descontado: pede para informar o mês.
- eSocial: versão inicial gera o resumo de rubricas para lançamento manual; webservice direto é estudo futuro.

### 4.2 Ferramentas extras
- Simuladores (com memória e aviso de estimativa): custo total de contratar; diarista × parcial × integral; rescisão; férias e 13º; reajuste; hora extra e noturno; regularização.
- Planejamento do cliente: provisão mensal (13º, férias, rescisão); painel de custos com gráfico; calendário com lembretes.
- Contrato de trabalho: checklists de admissão e desligamento; afastamentos (atestado, licença-maternidade 120 dias pelo INSS, auxílio por incapacidade pago pelo INSS desde o início, acidente); estabilidade (gestante até 5 meses após o parto, acidente) bloqueando demissão sem justa causa; vale-transporte (desconto até 6%); salário-família; reajuste anual; histórico do empregado.
- Documentos e assinaturas: central por empregado com busca; assinatura eletrônica; informe anual de rendimentos.
- Diagnóstico de riscos com nota de conformidade por cliente.
- Ferramentas do consultor: painel geral por prioridade; captação (leads, proposta automática pela tabela de preços); cobrança (Pix); controle de procurações; produtividade; registro de atividades; base de conhecimento.
- Atendimento: chat interno com histórico e respostas prontas.

## 5. Forma de entrega
Versão 1 (cadastros, calculadora de encargos, checklist e alertas) → documentos, férias, 13º e rescisão, financeiro, portal → ponto → extras.
Em cada etapa, explicar como testar e incluir dados de exemplo (ex.: parcial de 22h, R$ 810,50, admitida em 09/02/2026).

**Aviso no sistema:** os cálculos são estimativas de apoio; os valores oficiais são os gerados pelo eSocial, e questões judiciais devem ser encaminhadas a um advogado.

> Observação: o prompt inicial cita uma seção "PRIORIDADE MÁXIMA: AUTOMAÇÃO E ALERTAS AUTOMÁTICOS" que não estava
> nos documentos recebidos. O motor de alertas implementado segue a seção 2.5; se houver texto adicional, acrescente aqui.

---

## MÓDULO DE GESTÃO DISCIPLINAR (autonomia do empregador)

Objetivo: permitir que o empregador (cliente) aplique medidas disciplinares sozinho, com segurança jurídica,
guiado passo a passo pelo sistema. O consultor recebe cópia de tudo e é alertado em casos graves.

### Base legal a seguir
- LC 150/2015, art. 27 (justa causa do empregado doméstico e rescisão indireta), aplicando a CLT de forma subsidiária (art. 19).
- Suspensão máxima de 30 dias (CLT, art. 474); acima disso equivale a rescisão sem justa causa.
- Princípios obrigatórios: imediatidade, proporcionalidade, gradação (advertência → suspensão → justa causa, salvo falta gravíssima),
  non bis in idem, não discriminação e vínculo com o contrato.
- Proibido: multa em dinheiro, desconto como punição, humilhação, exposição, punição coletiva, rebaixamento de salário.

### Assistente guiado (fluxo para o empregador)
1. Registrar a ocorrência: data, hora, local, descrição objetiva, testemunhas, provas. O sistema orienta a escrever fatos, não opiniões.
2. Classificar a falta (atraso, falta injustificada, desrespeito, negligência, descumprimento de ordem, uso indevido de bens, falta grave do art. 27 etc.).
3. Ouvir a empregada: registrar a versão dela (direito de defesa), com prazo sugerido.
4. Recomendação automática pelo tipo de falta, histórico dos últimos 12 meses e tempo desde o fato, explicada em linguagem simples.
5. Checagens antes de emitir: tempo desde a falta (perdão tácito), falta já punida, desproporção, estabilidade/afastamento, indícios de descumprimento do empregador (rescisão indireta).
6. Gerar o documento (advertência ou suspensão) em PDF.
7. Assinatura eletrônica ou impressa; se recusar, fluxo com duas testemunhas e registro da recusa.
8. Efeitos automáticos: suspensão gera desconto dos dias na pré-folha e o lançamento a fazer no eSocial; arquivamento por 5 anos.

### Modelos de documentos
Registro de ocorrência; advertência verbal registrada; advertência escrita; suspensão (início, retorno e dias descontados);
termo de recusa de assinatura com testemunhas; convocação para esclarecimentos; comunicação de justa causa (só após revisão do consultor);
notificação de abandono de emprego (após 30 dias de faltas).

### Justa causa: trava obrigatória
O empregador NÃO finaliza justa causa sozinho. O sistema monta o dossiê e envia ao consultor, com recomendação de revisão por advogado.
Só após aprovação o documento é liberado. Mostrar ao empregador os riscos de reversão na Justiça.

### Histórico e painel
Linha do tempo disciplinar por empregado; pontuação de risco; alertas (prazo para aplicar a medida, fim da suspensão, assinatura pendente,
ocorrências repetidas); advertências com mais de 12 meses (configurável) pesam menos.

### Central de orientação
Páginas curtas: como conversar com a empregada, como escrever uma advertência, o que é proibido, quando chamar o consultor, boas práticas.

### Aviso no sistema
"As recomendações são orientativas e não substituem análise de advogado em casos graves."

---

## Simulador de benefícios para a empregada (carteira assinada x informal)

Objetivo: mostrar à trabalhadora, com números da família dela, o que acontece com os benefícios sociais se ela tiver a
carteira assinada ou não, e quais direitos e deveres ela passa a ter. Muitas recusam o registro por medo de perder o
Bolsa Família; o simulador deve esclarecer, nunca ensinar a esconder renda.

Entradas: quantas pessoas moram na casa (composição do CadÚnico); renda de cada pessoa (trabalho, pensão, outros
benefícios); salário proposto na carteira; benefícios atuais: Bolsa Família (valor e composição), BPC, outros.

Saídas (lado a lado: sem carteira x com carteira): renda per capita antes e depois; situação do Bolsa Família (mantém
integral, entra na regra de proteção — metade do benefício por até 2 anos se a renda per capita ficar até meio salário
mínimo — ou sai do programa); alerta específico para BPC (renda do trabalho pode afetar o benefício; recomendar orientação
no CRAS/INSS); direitos com o registro (FGTS, seguro-desemprego, aposentadoria, auxílio-doença, licença-maternidade,
férias + 1/3, 13º, proteção em acidente); deveres (desconto do INSS, jornada e registro de ponto, comunicar falta,
atualizar o CadÚnico); ganho financeiro total estimado em 12 meses e em 5 anos.

Regras: linguagem simples, pensada para mostrar no celular à empregada; sempre exibir o aviso
"Simulação estimada. Confirme no CRAS ou no app Bolsa Família."; gerar PDF/imagem para enviar por WhatsApp;
nunca sugerir omitir renda ou deixar de atualizar o CadÚnico.

**Regra de proteção atualizada:** a Portaria MDS nº 1.084/2025 mudou a regra a partir de junho/2025 — teto fixo de
R$ 706 por pessoa (antes, meio salário mínimo) e permanência de 12 meses (antes, até 24; quem já estava na regra segue
com as condições antigas). Os parâmetros `BF_PROTECAO_LIMITE` e `BF_PROTECAO_MESES` têm as duas vigências.

Implementação: `src/lib/calculos/beneficios-sociais.ts` (regras e testes), `src/components/calc/SimuladorBeneficios.tsx`,
páginas `/cliente/simuladores/beneficios` e `/consultor/simuladores/beneficios`. No cenário "sem carteira" usa-se a renda
atual dela (que também deve constar no CadÚnico); no "com carteira", o salário bruto proposto.

## Tabela de parâmetros legais e atualização

Todos os valores legais ficam numa tabela única de parâmetros (`Parametro`), com data de vigência, nunca fixos no código:
salário mínimo, faixas e alíquotas do INSS, alíquotas patronais e FGTS, limites e valores do Bolsa Família (linha de
pobreza, regra de proteção, benefícios por pessoa), critério do BPC, teto do salário-família, multa e juros do DAE.
- Tela de administração (`/consultor/parametros`) para editar os valores, com histórico: cálculos de meses passados usam
  o valor vigente na época (`tabelaNaData`).
- Campo de fonte oficial (link) e data da última conferência em cada parâmetro.
- Alerta automático todo dia 2 de janeiro e sempre que um parâmetro passar 6 meses sem conferência (painel, menu e e-mail).
- Opcional (implementado): às segundas-feiras a rotina diária verifica as páginas oficiais (gov.br) e avisa se mudaram;
  a atualização é sempre confirmada pelo consultor.
- Ao alterar um parâmetro, os cálculos e simulações passam a usar o novo valor automaticamente; o sistema lista os
  clientes afetados (ex.: salário abaixo do novo mínimo, DAE diferente) e permite avisá-los pelo chat.

Antes de usar com clientes, confira os valores atuais do Bolsa Família e do BPC no gov.br.
