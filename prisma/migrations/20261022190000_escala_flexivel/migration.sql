-- AlterTable
ALTER TABLE "Empregado" ADD COLUMN     "faixaFim" TEXT,
ADD COLUMN     "faixaInicio" TEXT,
ADD COLUMN     "horarioFlexivel" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EscalaDia" (
    "id" TEXT NOT NULL,
    "empregadoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "entrada" TEXT NOT NULL,
    "saida" TEXT NOT NULL,
    "automatica" BOOLEAN NOT NULL DEFAULT false,
    "definidoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalaDia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscalaDia_empregadoId_data_key" ON "EscalaDia"("empregadoId", "data");

-- AddForeignKey
ALTER TABLE "EscalaDia" ADD CONSTRAINT "EscalaDia_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "Empregado"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Segurança: a API pública do Supabase não lê esta tabela (acesso só pelo servidor)
ALTER TABLE "EscalaDia" ENABLE ROW LEVEL SECURITY;
