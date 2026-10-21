-- AlterTable
ALTER TABLE "Configuracao" ADD COLUMN     "mesesPesoDisciplinar" INTEGER NOT NULL DEFAULT 12;

-- CreateTable
CREATE TABLE "OcorrenciaDisciplinar" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "empregadoId" TEXT NOT NULL,
    "dataFato" DATE NOT NULL,
    "horaFato" TEXT,
    "local" TEXT,
    "dataCiencia" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "testemunhas" TEXT,
    "provasIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tipoFalta" TEXT NOT NULL,
    "gravidade" TEXT NOT NULL,
    "versaoEmpregado" TEXT,
    "prazoDefesa" DATE,
    "defesaRegistradaEm" TIMESTAMP(3),
    "recomendacao" JSONB,
    "medida" TEXT,
    "diasSuspensao" INTEGER,
    "inicioSuspensao" DATE,
    "justificativaMedida" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REGISTRADA',
    "documentoId" TEXT,
    "documentosIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assinaturaForma" TEXT,
    "recusaAssinatura" BOOLEAN NOT NULL DEFAULT false,
    "testemunhasRecusa" TEXT,
    "parecerConsultor" TEXT,
    "revisadoPorId" TEXT,
    "revisadoEm" TIMESTAMP(3),
    "aplicadaEm" TIMESTAMP(3),
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcorrenciaDisciplinar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OcorrenciaDisciplinar_clienteId_criadoEm_idx" ON "OcorrenciaDisciplinar"("clienteId", "criadoEm");

-- CreateIndex
CREATE INDEX "OcorrenciaDisciplinar_empregadoId_dataFato_idx" ON "OcorrenciaDisciplinar"("empregadoId", "dataFato");

-- CreateIndex
CREATE INDEX "OcorrenciaDisciplinar_status_idx" ON "OcorrenciaDisciplinar"("status");

-- AddForeignKey
ALTER TABLE "OcorrenciaDisciplinar" ADD CONSTRAINT "OcorrenciaDisciplinar_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcorrenciaDisciplinar" ADD CONSTRAINT "OcorrenciaDisciplinar_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "Empregado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
