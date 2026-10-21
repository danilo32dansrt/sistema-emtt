-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('CONSULTOR', 'CLIENTE', 'EMPREGADO');

-- CreateEnum
CREATE TYPE "StatusProcuracao" AS ENUM ('PENDENTE', 'ATIVA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "Regime" AS ENUM ('INTEGRAL', 'PARCIAL', 'DOZE_X_TRINTA_SEIS');

-- CreateEnum
CREATE TYPE "SituacaoEmpregado" AS ENUM ('ATIVO', 'AFASTADO', 'DESLIGADO');

-- CreateEnum
CREATE TYPE "TipoMarcacao" AS ENUM ('ENTRADA', 'SAIDA_INTERVALO', 'RETORNO_INTERVALO', 'SAIDA');

-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "StatusCobranca" AS ENUM ('ABERTO', 'PAGO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusLead" AS ENUM ('NOVO', 'CONTATO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "clienteId" TEXT,
    "empregadoId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tentativasFalhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(3),
    "trocarSenha" BOOLEAN NOT NULL DEFAULT false,
    "ultimoAcesso" TIMESTAMP(3),
    "consentimentoLgpdEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcessoLog" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "email" TEXT NOT NULL,
    "sucesso" BOOLEAN NOT NULL,
    "motivo" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcessoLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atividade" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "clienteId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT,
    "entidadeId" TEXT,
    "descricao" TEXT NOT NULL,
    "ip" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Atividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "id" TEXT NOT NULL DEFAULT 'principal',
    "nomeConsultoria" TEXT NOT NULL DEFAULT 'Consultoria eSocial Doméstico',
    "documento" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "chavePix" TEXT,
    "nomePix" TEXT,
    "cidadePix" TEXT,
    "regraFeriasParcial" TEXT NOT NULL DEFAULT 'CLT',
    "selicMensal" DECIMAL(6,4) NOT NULL DEFAULT 1.0,
    "diaLimiteInfo" INTEGER NOT NULL DEFAULT 30,
    "diaEmissaoGuias" INTEGER NOT NULL DEFAULT 4,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TabelaAnual" (
    "ano" INTEGER NOT NULL,
    "salarioMinimo" DECIMAL(12,2) NOT NULL,
    "faixasInss" JSONB NOT NULL,
    "salarioFamiliaLimite" DECIMAL(12,2) NOT NULL,
    "salarioFamiliaCota" DECIMAL(12,2) NOT NULL,
    "inssPatronal" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "gilrat" DECIMAL(5,2) NOT NULL DEFAULT 0.8,
    "fgts" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "fgtsCompensatorio" DECIMAL(5,2) NOT NULL DEFAULT 3.2,
    "arredondamentoDae" TEXT NOT NULL DEFAULT 'truncar',
    "observacoes" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TabelaAnual_pkey" PRIMARY KEY ("ano")
);

-- CreateTable
CREATE TABLE "TabelaPreco" (
    "id" TEXT NOT NULL,
    "servico" TEXT NOT NULL,
    "descricao" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT 'avulso',
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TabelaPreco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeloMensagem" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,

    CONSTRAINT "ModeloMensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "cep" TEXT,
    "inicioContrato" DATE NOT NULL,
    "mensalidade" DECIMAL(12,2) NOT NULL,
    "diaVencimento" INTEGER NOT NULL DEFAULT 10,
    "procuracaoStatus" "StatusProcuracao" NOT NULL DEFAULT 'PENDENTE',
    "procuracaoValidade" DATE,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "anonimizadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empregado" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "nascimento" DATE,
    "telefone" TEXT,
    "funcao" TEXT NOT NULL,
    "cbo" TEXT NOT NULL,
    "admissao" DATE NOT NULL,
    "salario" DECIMAL(12,2) NOT NULL,
    "regime" "Regime" NOT NULL DEFAULT 'INTEGRAL',
    "horasSemanais" DECIMAL(5,2) NOT NULL,
    "jornada" JSONB NOT NULL,
    "horarios" JSONB,
    "situacao" "SituacaoEmpregado" NOT NULL DEFAULT 'ATIVO',
    "desligamento" DATE,
    "motivoDesligamento" TEXT,
    "diasExperiencia" INTEGER,
    "acordoCompensacao" BOOLEAN NOT NULL DEFAULT false,
    "acordoIntervaloReduzido" BOOLEAN NOT NULL DEFAULT false,
    "acordo12x36" BOOLEAN NOT NULL DEFAULT false,
    "acordoViagem" BOOLEAN NOT NULL DEFAULT false,
    "residenteNoLocal" BOOLEAN NOT NULL DEFAULT false,
    "referencia12x36" DATE,
    "toleranciaMinutos" INTEGER NOT NULL DEFAULT 5,
    "dependentesSalarioFamilia" INTEGER NOT NULL DEFAULT 0,
    "custoValeTransporte" DECIMAL(12,2),
    "gestante" BOOLEAN NOT NULL DEFAULT false,
    "dataPrevistaParto" DATE,
    "estabilidadeAte" DATE,
    "estabilidadeMotivo" TEXT,
    "pontoAtivo" BOOLEAN NOT NULL DEFAULT false,
    "exigirSelfie" BOOLEAN NOT NULL DEFAULT true,
    "exigirLocalizacao" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empregado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoEmpregado" (
    "id" TEXT NOT NULL,
    "empregadoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoEmpregado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ferias" (
    "id" TEXT NOT NULL,
    "empregadoId" TEXT NOT NULL,
    "inicioAquisitivo" DATE NOT NULL,
    "inicioGozo" DATE NOT NULL,
    "dias" INTEGER NOT NULL,
    "diasAbono" INTEGER NOT NULL DEFAULT 0,
    "valorLiquido" DECIMAL(12,2),
    "pagoEm" DATE,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ferias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Afastamento" (
    "id" TEXT NOT NULL,
    "empregadoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "observacoes" TEXT,
    "arquivoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Afastamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competencia" (
    "id" TEXT NOT NULL,
    "empregadoId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "infoRecebida" BOOLEAN NOT NULL DEFAULT false,
    "folhaLancada" BOOLEAN NOT NULL DEFAULT false,
    "folhaEncerrada" BOOLEAN NOT NULL DEFAULT false,
    "daeEmitido" BOOLEAN NOT NULL DEFAULT false,
    "daeEnviado" BOOLEAN NOT NULL DEFAULT false,
    "pagamentoConfirmado" BOOLEAN NOT NULL DEFAULT false,
    "reciboArquivado" BOOLEAN NOT NULL DEFAULT false,
    "daeValor" DECIMAL(12,2),
    "daeCodigo" TEXT,
    "daeArquivoId" TEXT,
    "comprovanteArquivoId" TEXT,
    "clienteInformouPagamentoEm" TIMESTAMP(3),
    "observacoes" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LancamentoMensal" (
    "id" TEXT NOT NULL,
    "empregadoId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "faltasInjustificadas" INTEGER NOT NULL DEFAULT 0,
    "semanasComFalta" INTEGER NOT NULL DEFAULT 0,
    "faltasJustificadas" INTEGER NOT NULL DEFAULT 0,
    "atrasoMinutos" INTEGER NOT NULL DEFAULT 0,
    "horasExtras50" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "horasExtras100" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "horasNoturnas" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "horasViagem" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "horasIntervaloSuprimido" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "adiantamento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outrosProventos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outrosDescontos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'CLIENTE',
    "enviadoPorId" TEXT,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LancamentoMensal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarcacaoPonto" (
    "id" TEXT NOT NULL,
    "nsr" SERIAL NOT NULL,
    "empregadoId" TEXT NOT NULL,
    "tipo" "TipoMarcacao" NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "precisaoMetros" DOUBLE PRECISION,
    "selfieArquivoId" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'ONLINE',
    "dispositivo" TEXT,
    "ip" TEXT,
    "idLocal" TEXT NOT NULL,
    "hashAnterior" TEXT,
    "hash" TEXT NOT NULL,

    CONSTRAINT "MarcacaoPonto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AjustePonto" (
    "id" TEXT NOT NULL,
    "empregadoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" TEXT NOT NULL,
    "marcacaoId" TEXT,
    "dataHora" TIMESTAMP(3),
    "tipoMarcacao" "TipoMarcacao",
    "justificativa" TEXT NOT NULL,
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'PENDENTE',
    "solicitadoPorId" TEXT,
    "decididoPorId" TEXT,
    "decididoEm" TIMESTAMP(3),
    "motivoDecisao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AjustePonto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Justificativa" (
    "id" TEXT NOT NULL,
    "empregadoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "dataFim" DATE,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "arquivoId" TEXT,
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'PENDENTE',
    "decididoPorId" TEXT,
    "decididoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Justificativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EspelhoPonto" (
    "id" TEXT NOT NULL,
    "empregadoId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "resumo" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "documentoId" TEXT,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assinadoEmpregadoEm" TIMESTAMP(3),
    "assinadoEmpregadorEm" TIMESTAMP(3),

    CONSTRAINT "EspelhoPonto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Arquivo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "dados" BYTEA NOT NULL,
    "clienteId" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Arquivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "empregadoId" TEXT,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "arquivoId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "competencia" TEXT,
    "exigeAssinaturaEmpregado" BOOLEAN NOT NULL DEFAULT false,
    "exigeAssinaturaCliente" BOOLEAN NOT NULL DEFAULT false,
    "visivelCliente" BOOLEAN NOT NULL DEFAULT true,
    "visivelEmpregado" BOOLEAN NOT NULL DEFAULT false,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assinatura" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "assinadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "hashDocumento" TEXT NOT NULL,

    CONSTRAINT "Assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensalidade" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "vencimento" DATE NOT NULL,
    "status" "StatusCobranca" NOT NULL DEFAULT 'ABERTO',
    "pagoEm" DATE,
    "formaPagamento" TEXT,
    "txid" TEXT,
    "lembreteEnviadoEm" TIMESTAMP(3),
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensalidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicoAvulso" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "data" DATE NOT NULL,
    "status" "StatusCobranca" NOT NULL DEFAULT 'ABERTO',
    "pagoEm" DATE,
    "formaPagamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicoAvulso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "cidade" TEXT,
    "qtdEmpregados" INTEGER NOT NULL DEFAULT 1,
    "servicos" JSONB,
    "origem" TEXT,
    "status" "StatusLead" NOT NULL DEFAULT 'NOVO',
    "valorProposta" DECIMAL(12,2),
    "propostaEm" TIMESTAMP(3),
    "proximoContato" DATE,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroTempo" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "tarefa" TEXT NOT NULL,
    "minutos" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroTempo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidaEm" TIMESTAMP(3),

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RespostaPronta" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'Geral',

    CONSTRAINT "RespostaPronta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artigo" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "publico" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artigo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_empregadoId_key" ON "Usuario"("empregadoId");

-- CreateIndex
CREATE INDEX "Usuario_clienteId_idx" ON "Usuario"("clienteId");

-- CreateIndex
CREATE INDEX "AcessoLog_email_criadoEm_idx" ON "AcessoLog"("email", "criadoEm");

-- CreateIndex
CREATE INDEX "Atividade_clienteId_criadoEm_idx" ON "Atividade"("clienteId", "criadoEm");

-- CreateIndex
CREATE INDEX "Atividade_criadoEm_idx" ON "Atividade"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "TabelaPreco_servico_key" ON "TabelaPreco"("servico");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloMensagem_chave_key" ON "ModeloMensagem"("chave");

-- CreateIndex
CREATE INDEX "Cliente_nome_idx" ON "Cliente"("nome");

-- CreateIndex
CREATE INDEX "Empregado_clienteId_idx" ON "Empregado"("clienteId");

-- CreateIndex
CREATE INDEX "HistoricoEmpregado_empregadoId_data_idx" ON "HistoricoEmpregado"("empregadoId", "data");

-- CreateIndex
CREATE INDEX "Ferias_empregadoId_idx" ON "Ferias"("empregadoId");

-- CreateIndex
CREATE INDEX "Afastamento_empregadoId_idx" ON "Afastamento"("empregadoId");

-- CreateIndex
CREATE INDEX "Competencia_ano_mes_idx" ON "Competencia"("ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "Competencia_empregadoId_ano_mes_key" ON "Competencia"("empregadoId", "ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "LancamentoMensal_empregadoId_ano_mes_key" ON "LancamentoMensal"("empregadoId", "ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "MarcacaoPonto_nsr_key" ON "MarcacaoPonto"("nsr");

-- CreateIndex
CREATE UNIQUE INDEX "MarcacaoPonto_idLocal_key" ON "MarcacaoPonto"("idLocal");

-- CreateIndex
CREATE INDEX "MarcacaoPonto_empregadoId_dataHora_idx" ON "MarcacaoPonto"("empregadoId", "dataHora");

-- CreateIndex
CREATE INDEX "AjustePonto_empregadoId_data_idx" ON "AjustePonto"("empregadoId", "data");

-- CreateIndex
CREATE INDEX "Justificativa_empregadoId_data_idx" ON "Justificativa"("empregadoId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "EspelhoPonto_empregadoId_ano_mes_key" ON "EspelhoPonto"("empregadoId", "ano", "mes");

-- CreateIndex
CREATE INDEX "Arquivo_clienteId_idx" ON "Arquivo"("clienteId");

-- CreateIndex
CREATE INDEX "Documento_clienteId_criadoEm_idx" ON "Documento"("clienteId", "criadoEm");

-- CreateIndex
CREATE INDEX "Documento_empregadoId_idx" ON "Documento"("empregadoId");

-- CreateIndex
CREATE UNIQUE INDEX "Assinatura_documentoId_usuarioId_key" ON "Assinatura"("documentoId", "usuarioId");

-- CreateIndex
CREATE INDEX "Mensalidade_status_vencimento_idx" ON "Mensalidade"("status", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "Mensalidade_clienteId_ano_mes_key" ON "Mensalidade"("clienteId", "ano", "mes");

-- CreateIndex
CREATE INDEX "ServicoAvulso_clienteId_idx" ON "ServicoAvulso"("clienteId");

-- CreateIndex
CREATE INDEX "RegistroTempo_clienteId_data_idx" ON "RegistroTempo"("clienteId", "data");

-- CreateIndex
CREATE INDEX "Mensagem_clienteId_criadoEm_idx" ON "Mensagem"("clienteId", "criadoEm");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "Empregado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empregado" ADD CONSTRAINT "Empregado_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoEmpregado" ADD CONSTRAINT "HistoricoEmpregado_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "Empregado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ferias" ADD CONSTRAINT "Ferias_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "Empregado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Afastamento" ADD CONSTRAINT "Afastamento_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "Empregado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competencia" ADD CONSTRAINT "Competencia_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "Empregado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoMensal" ADD CONSTRAINT "LancamentoMensal_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "Empregado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarcacaoPonto" ADD CONSTRAINT "MarcacaoPonto_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "Empregado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjustePonto" ADD CONSTRAINT "AjustePonto_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "Empregado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Justificativa" ADD CONSTRAINT "Justificativa_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "Empregado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EspelhoPonto" ADD CONSTRAINT "EspelhoPonto_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "Empregado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "Empregado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assinatura" ADD CONSTRAINT "Assinatura_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assinatura" ADD CONSTRAINT "Assinatura_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensalidade" ADD CONSTRAINT "Mensalidade_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicoAvulso" ADD CONSTRAINT "ServicoAvulso_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroTempo" ADD CONSTRAINT "RegistroTempo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Marcações de ponto inalteráveis (Portaria MTP 671/2021): nada pode ser
-- alterado ou apagado. Correções são feitas por ajuste justificado (AjustePonto).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloquear_alteracao_marcacao() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Marcações de ponto são inalteráveis. Use um ajuste justificado.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER marcacao_ponto_inalteravel
  BEFORE UPDATE OR DELETE ON "MarcacaoPonto"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_marcacao();

-- Assinaturas também não podem ser alteradas depois de feitas.
CREATE OR REPLACE FUNCTION bloquear_alteracao_assinatura() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM "Documento" WHERE id = OLD."documentoId") THEN
    RETURN OLD; -- exclusão em cascata do documento (pedido de exclusão LGPD)
  END IF;
  RAISE EXCEPTION 'Assinaturas eletrônicas são inalteráveis.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assinatura_inalteravel
  BEFORE UPDATE ON "Assinatura"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_assinatura();

-- ---------------------------------------------------------------------------
-- Row Level Security: no Supabase, impede que a API pública (chave "anon")
-- leia qualquer tabela. O sistema acessa o banco só pelo servidor (Prisma),
-- com o usuário dono das tabelas, e filtra cada consulta pelo cliente logado.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
