-- AlterTable
ALTER TABLE "Configuracao" ADD COLUMN     "cobrancaInter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "diasBaixaInter" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "jurosMensalidade" DECIMAL(5,2) NOT NULL DEFAULT 1,
ADD COLUMN     "multaMensalidade" DECIMAL(5,2) NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "Mensalidade" ADD COLUMN     "interAtualizadoEm" TIMESTAMP(3),
ADD COLUMN     "interCodigo" TEXT,
ADD COLUMN     "interErro" TEXT,
ADD COLUMN     "interSituacao" TEXT,
ADD COLUMN     "linhaDigitavel" TEXT,
ADD COLUMN     "pixCopiaECola" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Mensalidade_interCodigo_key" ON "Mensalidade"("interCodigo");

