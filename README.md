# eSocial Doméstico — Sistema de Gestão da Consultoria

Sistema web para uma consultoria que cuida do eSocial Doméstico de vários empregadores.
Tem três acessos, cada um vendo **apenas os próprios dados**:

| Quem | Onde entra | O que faz |
|---|---|---|
| **Consultor** | `/consultor` | Cadastra clientes e empregados, faz a rotina mensal, calcula DAE, 13º, férias e rescisão, gera documentos, recebe alertas, controla o financeiro |
| **Cliente (empregador)** | `/cliente` | Vê o mês dos empregados, informa faltas e extras, baixa o DAE e marca como pago, assina documentos, usa simuladores, aplica medidas disciplinares guiadas, fala com o consultor |
| **Empregado** | `/ponto` (app no celular) | Marca o ponto (até sem internet), recebe comprovante, justifica faltas, assina o espelho |

> **Aviso:** os cálculos são estimativas de apoio; os valores oficiais são os gerados pelo eSocial, e questões judiciais devem ser encaminhadas a um advogado.

---

## O que já está pronto

**Versão 1 (base)**
- Cadastro de clientes (procuração, mensalidade, vencimento) e empregados (regime, jornada por dia, acordos), com alertas de: salário abaixo do mínimo proporcional, tempo parcial acima de 25h/6h, diarista (2 dias ou menos), menor de idade, 12x36 sem acordo, experiência acima de 90 dias.
- **Calculadora** com memória de cálculo: folha e DAE, 13º, férias (com abono e dobro), rescisão (8 tipos), regularização com multa e Selic.
- **Rotina mensal** (checklist de 7 etapas por empregado) com atrasos em vermelho e DAE estimado.
- **Agenda e alertas automáticos** (DAE, 13º, férias, experiência, procuração, aniversário de admissão, reajuste) + arquivo para o calendário do celular + e-mails diários.

**Depois da versão 1**
- Documentos em PDF com **assinatura eletrônica**: contrato, acordos, recibos (salário, férias, 13º, adiantamento), aviso de férias, aviso prévio, folha de ponto, espelho de ponto, informe de rendimentos, contrato de prestação de serviços.
- **Aplicativo de ponto** (instalável, funciona offline): selfie e localização só na hora da marcação, marcações que não podem ser alteradas (o banco bloqueia), comprovante com código de autenticidade, ajustes e justificativas aprovados pelo empregador, espelho mensal com valores em reais por rubrica, arquivos AFD/AEJ.
- **Portal do cliente**, **simuladores** (custo de contratar, diarista × mensalista, reajuste, hora extra/noturno, rescisão, férias, 13º, regularização), painel de custos, provisão mensal.
- **Gestão disciplinar** guiada: registro dos fatos, versão da empregada, recomendação automática pela gradação, checagens de segurança, 8 modelos de documento, recusa de assinatura com testemunhas, desconto da suspensão na folha e **trava da justa causa** (só o consultor libera).
- **Simulador de benefícios** para mostrar à empregada (carteira assinada × informal): renda por pessoa, situação do Bolsa Família (integral, regra de proteção ou saída), alerta de BPC, direitos e deveres, ganho em 12 meses e 5 anos, PDF e WhatsApp.
- **Parâmetros legais** com data de vigência, histórico, fonte oficial e data de conferência (salário mínimo, INSS, encargos, salário-família, multa/juros do DAE, Bolsa Família, BPC), com alertas e aviso aos clientes afetados.
- **Diagnóstico de riscos** com nota de 0 a 100 por cliente.
- **Financeiro** (mensalidades, avulsos, inadimplência, Pix copia e cola com QR Code), **captação** (funil e proposta em PDF), chat, base de conhecimento, produtividade, registro de atividades.
- **LGPD**: senhas criptografadas, CPF mascarado, registro de acessos, exportação em planilha, backup e exclusão a pedido.

---

## Como testar no seu computador

1. Instale o **Node.js** (versão 20 ou mais nova) e o **PostgreSQL** (ou use um banco gratuito do Supabase).
2. Na pasta do projeto:
   ```bash
   npm install
   cp .env.example .env      # depois edite o .env com o endereço do banco e um AUTH_SECRET longo
   npm run db:deploy         # cria as tabelas
   npm run db:seed           # tabelas de 2024–2026 e dados de exemplo
   npm run dev
   ```
3. Abra http://localhost:3000 e entre com um dos usuários de exemplo:

| Perfil | E-mail | Senha |
|---|---|---|
| Consultor | consultor@exemplo.com.br | Consultor123 |
| Cliente (Suely) | suely@exemplo.com.br | Cliente123 |
| Empregada (Maria) | maria@exemplo.com.br | Empregada123 |

**Troque essas senhas** (ou apague os usuários de exemplo) antes de usar com clientes reais.

Os dados de exemplo trazem um empregado de cada regime: **Maria** (parcial 22h, R$ 810,50, admitida em 09/02/2026 — o caso real conferido com o eSocial), **Joana** (integral 44h, com banco de horas), **Ana** (12x36 noturno das 19h às 7h) e **Rosa** (jornada noturna das 22h às 7h).

### Testes automáticos dos cálculos
```bash
npm test
```
São 95 testes. O principal confere o caso real de fevereiro/2026: proporcional **R$ 578,93**, INSS **R$ 43,41**, líquido **R$ 535,52** e DAE **R$ 159,18**; e o mês cheio: INSS **R$ 60,78** e líquido **R$ 749,72**.

> ⚠️ **Ponto em aberto:** no mês cheio o eSocial gerou DAE de **R$ 222,89** e o sistema calcula **R$ 222,87**. Nenhuma regra única de arredondamento reproduz os dois DAEs ao mesmo tempo. Para acertar, precisamos da guia do mês cheio com as parcelas separadas (INSS, GILRAT, FGTS e FGTS compensatório).

---

## Como publicar na internet (Supabase + Vercel)

1. **Supabase** (banco): crie um projeto em supabase.com → *Project Settings → Database* → copie as *connection strings*:
   - `DATABASE_URL` = a do **pooler** (porta 6543), acrescentando `?pgbouncer=true`
   - `DIRECT_URL` = a conexão **direta** (porta 5432)
   Ative os backups automáticos do Supabase.
2. **GitHub**: envie este código para um repositório seu.
3. **Vercel**: *Add New Project* → escolha o repositório → em *Environment Variables* cadastre tudo o que está no `.env.example` (com valores reais):
   `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (gere com `openssl rand -base64 48`), `CRON_SECRET`, `APP_URL` e, se quiser e-mails, `RESEND_API_KEY` e `EMAIL_REMETENTE`.
4. Mude o comando de build na Vercel para `prisma migrate deploy && npm run build` (cria/atualiza as tabelas a cada publicação).
5. **Primeiro acesso (sem comandos):** abra o endereço do sistema — com o banco vazio ele leva à tela *Primeiro acesso*,
   onde você cria a sua conta de consultor. Depois cadastre clientes e empregadas e crie o acesso de cada um pelo sistema.
   Faça isso logo após publicar (a tela só funciona enquanto não houver nenhum consultor).
   Opcional, para carregar dados de exemplo: rode uma vez no seu computador, apontando o `.env` para o Supabase:
   `npm run db:seed` — ou `npx tsx prisma/seed.ts --somente-tabelas` para carregar só as tabelas anuais, sem dados de exemplo.
6. A rotina diária (`/api/cron/diario`) já está agendada no `vercel.json` (07h de Brasília). A Vercel envia o `CRON_SECRET` automaticamente.

## Cobrança automática pelo Banco Inter (mensalidades)

Com a conta **PJ** do Inter, o sistema emite todo mês a cobrança de cada cliente (**Pix com QR Code + boleto**)
e dá **baixa sozinho** quando o pagamento cai. Cartão de crédito não está na API do Inter: use o link de pagamento
do app Inter Empresas e dê baixa manual (botão "Pago").

1. **No Inter**: Internet Banking Inter Empresas (computador) → *Soluções para sua empresa* → *Nova integração*.
   Marque as permissões de **Cobrança (boleto com Pix) — consulta e emissão** e **Webhook**.
   Baixe o **certificado (.crt)**, a **chave (.key)** e anote o **Client ID** e o **Client Secret**.
   Nunca envie esses dados por chat ou e-mail: eles dão acesso à conta da empresa.
2. **No `.env` (e na Vercel → Environment Variables)**: preencha as variáveis `INTER_*` do `.env.example`.
   O certificado e a chave vão em base64: `base64 -w0 arquivo.crt` (Linux) ou `base64 -i arquivo.crt` (Mac).
   Comece com `INTER_AMBIENTE="sandbox"` (testes, sem dinheiro de verdade; a integração de testes é criada no próprio portal do Inter).
3. **No sistema**: *Configurações → Cobrança automática* → **Testar conexão** → **Cadastrar aviso de pagamento no Inter**
   (precisa do `APP_URL` público com https e do `INTER_WEBHOOK_TOKEN`) → marque **Emitir as cobranças pelo Inter** e salve.
4. **Testar**: em *Financeiro*, gere as mensalidades, clique em **Emitir cobrança** e depois em **Simular Pix (teste)**
   (só aparece no ambiente de testes). A mensalidade deve virar "pago" sozinha.
5. **Para valer**: troque para `INTER_AMBIENTE="producao"` com as credenciais da integração de produção e cadastre o aviso de pagamento de novo.

Como funciona: no dia 1º a rotina diária gera as mensalidades e emite as cobranças; o Inter avisa o sistema quando o
cliente paga (o sistema confirma consultando o banco antes de dar baixa) e, por segurança, a rotina diária confere de
novo as cobranças pendentes. O cliente precisa ter **CPF/CNPJ, endereço, cidade, UF e CEP** no cadastro. Ao dar baixa
manual (pagamento por outro meio), o sistema cancela a cobrança no Inter para evitar pagamento em dobro.

## Avisos no celular (patrão e empregada)

Consultor, patrão e empregada usam o sistema também como **aplicativo no celular** (instalável pelo navegador; é o mesmo
sistema da web — tudo o que é feito num aparece no outro). Os avisos chegam com o app fechado e o celular bloqueado.
Enquanto uma pendência continuar (entrada, intervalo, saída, dia sem marcação, pedido sem resposta, guias, DAE), o
lembrete se repete a cada hora até alguém resolver, e a pendência aparece na tela inicial com o botão que resolve.
O sistema avisa: hora de bater o ponto, de sair e voltar do intervalo, de marcar a saída; dia sem marcação ou incompleto
(para os dois); pedidos de ajuste e justificativas (para o patrão) e a resposta (para a empregada); DAE a vencer, vencendo
e atrasado. Tudo fica também na tela **Avisos** de cada um.

**Alerta na tela até resolver:** ao abrir o app com alguma pendência, aparece um alerta grande por cima de tudo, com os
botões que resolvem (Aprovar, Trabalhou no horário, Pagar o DAE…). Ele só some quando tudo é resolvido; "Resolver depois"
adia por 1 hora. No celular, as notificações com botão ficam fixas na tela até a pessoa tocar.

**SOS (emergência na casa):** no app do ponto há um botão vermelho **SOS**, fixo no canto de todas as telas. A empregada segura por 2 segundos (um toque
rápido não aciona) e na hora: os patrões e a consultoria recebem um alerta urgente (vibra forte e fica fixo na tela), com a
localização; o celular dela começa a gravar o áudio (enviado a cada 15 segundos, por até 10 minutos) e mostra os botões
para ligar 192, 193 e 190. Quem tocar em **Estou indo** faz aparecer na tela dela "Fulano está indo". Enquanto ninguém
responder, o alerta se repete. As gravações ficam na página da emergência, só para os patrões e a consultoria.

1. Chaves das notificações: **não precisa fazer nada** — o sistema gera sozinho no primeiro uso e guarda no banco.
   (Opcional: para usar as suas, gere com `npx web-push generate-vapid-keys` e coloque `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY` e `VAPID_ASSUNTO` no `.env` e na Vercel.)
2. Os lembretes do ponto precisam rodar **a cada 10 minutos**. No plano gratuito da Vercel o agendamento só roda 1 vez por
   dia; use um agendador gratuito como o **cron-job.org**: crie uma tarefa a cada 10 minutos chamando
   `https://SEU-ENDERECO/api/cron/lembretes` com o cabeçalho `Authorization: Bearer <CRON_SECRET>`.
3. No celular: **Android** — abra o sistema no Chrome, toque em **Ativar avisos no celular** (e, se quiser, "Instalar app").
   **iPhone** (iOS 16.4 ou mais novo) — no Safari toque em Compartilhar → **Adicionar à Tela de Início**, abra pelo ícone e
   ative os avisos (a Apple só permite avisos com o app instalado).

## Planos Básico, Médio e Plus

Cada cliente tem um plano (cadastro do cliente). Os preços sugeridos ficam em *Configurações → Planos*.
No **Plus**, o empregador paga **uma cobrança só por mês (mensalidade + DAE)** e a **consultoria paga o DAE por ele**:

1. Até o dia de emissão, registre o DAE de cada empregado na *Rotina mensal* com o **valor e o código de barras completo**.
2. Quando todos os DAEs do cliente estiverem prontos, o sistema monta a cobrança do mês (vencimento no dia combinado,
   padrão dia 5, sempre antes do DAE) e, se a cobrança pelo Inter estiver ligada, emite Pix + boleto.
3. Quando o cliente paga, o DAE fica "dinheiro recebido": com *Pagar o DAE automaticamente pelo Inter* ligado, o
   sistema agenda o pagamento para o vencimento (na integração do Inter marque também a permissão **Pagamentos**;
   se a sua conta exigir, aprove o pagamento no app do Inter — o sistema avisa). Sem isso, pague e clique em
   *Marcar como pago*. O cliente é avisado e vê "pago pela consultoria".
4. Se o cliente não pagar, ele recebe lembretes de hora em hora e você é avisado. **O DAE nunca é pago com dinheiro da
   consultoria.** Combine com o contador o registro desse valor como repasse e inclua no contrato a cláusula de
   pagamento por conta e ordem do cliente.

---

## Antes de vender o sistema

- Peça a um **contador ou advogado trabalhista** para revisar as regras e os cálculos (principalmente rescisão, férias do tempo parcial e o módulo disciplinar).
- Confira os **parâmetros legais** (tela *Parâmetros legais*): todos chegam sem data de conferência e o sistema pede para conferir cada um na fonte oficial. Confira principalmente os valores de 2026 e os do **Bolsa Família e BPC** no gov.br antes de usar o simulador com clientes.
- Para vender o aplicativo de ponto como **REP-P**: é preciso registro do programa no **INPI**, atestado técnico e termo de responsabilidade, além de seguir a **Portaria MTP 671/2021** (os arquivos AFD/AEJ gerados devem ser validados com o leiaute oficial).
- **Férias no tempo parcial**: há divergência entre a LC 150 (tabela de 8 a 18 dias) e a CLT após a Reforma (30 dias). O sistema usa 30 dias por padrão (mais seguro) e permite trocar em *Configurações*.

## Organização técnica

Veja o arquivo `CLAUDE.md` (escopo completo do projeto e mapa do código). Resumo: Next.js 15 + TypeScript + Tailwind, PostgreSQL via Prisma, cálculos em `src/lib/calculos` (puros e testados), PDFs com `pdf-lib`.
