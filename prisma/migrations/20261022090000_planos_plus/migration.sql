-- CreateEnum
CREATE TYPE "PlanoCliente" AS ENUM ('BASICO', 'MEDIO', 'PLUS');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "plano" "PlanoCliente" NOT NULL DEFAULT 'BASICO';

-- AlterTable
ALTER TABLE "Configuracao" ADD COLUMN     "diaVencimentoPlus" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "pagamentoDaeInter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "precoBasico" DECIMAL(12,2),
ADD COLUMN     "precoMedio" DECIMAL(12,2),
ADD COLUMN     "precoPlus" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Mensalidade" ADD COLUMN     "valorDae" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PagamentoDae" (
    "id" TEXT NOT NULL,
    "competenciaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "mensalidadeId" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "codigoBarras" TEXT NOT NULL,
    "vencimento" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO_RECURSO',
    "interTransacao" TEXT,
    "interStatus" TEXT,
    "agendadoPara" DATE,
    "pagoEm" TIMESTAMP(3),
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PagamentoDae_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PagamentoDae_competenciaId_key" ON "PagamentoDae"("competenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "PagamentoDae_interTransacao_key" ON "PagamentoDae"("interTransacao");

-- CreateIndex
CREATE INDEX "PagamentoDae_status_idx" ON "PagamentoDae"("status");

-- CreateIndex
CREATE INDEX "PagamentoDae_clienteId_idx" ON "PagamentoDae"("clienteId");

-- AddForeignKey
ALTER TABLE "PagamentoDae" ADD CONSTRAINT "PagamentoDae_competenciaId_fkey" FOREIGN KEY ("competenciaId") REFERENCES "Competencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoDae" ADD CONSTRAINT "PagamentoDae_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoDae" ADD CONSTRAINT "PagamentoDae_mensalidadeId_fkey" FOREIGN KEY ("mensalidadeId") REFERENCES "Mensalidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Segurança: a API pública do Supabase não lê esta tabela (acesso só pelo servidor)
ALTER TABLE "PagamentoDae" ENABLE ROW LEVEL SECURITY;
