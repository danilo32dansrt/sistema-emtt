-- CreateTable
CREATE TABLE "Emergencia" (
    "id" TEXT NOT NULL,
    "empregadoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "precisao" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "atendidaPorId" TEXT,
    "atendidaPor" TEXT,
    "atendidaEm" TIMESTAMP(3),
    "encerradaEm" TIMESTAMP(3),
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Emergencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergenciaTrecho" (
    "id" TEXT NOT NULL,
    "emergenciaId" TEXT NOT NULL,
    "arquivoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergenciaTrecho_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Emergencia_clienteId_status_idx" ON "Emergencia"("clienteId", "status");

-- CreateIndex
CREATE INDEX "EmergenciaTrecho_emergenciaId_ordem_idx" ON "EmergenciaTrecho"("emergenciaId", "ordem");

-- AddForeignKey
ALTER TABLE "Emergencia" ADD CONSTRAINT "Emergencia_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "Empregado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergenciaTrecho" ADD CONSTRAINT "EmergenciaTrecho_emergenciaId_fkey" FOREIGN KEY ("emergenciaId") REFERENCES "Emergencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Segurança: a API pública do Supabase não lê estas tabelas (acesso só pelo servidor)
ALTER TABLE "Emergencia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmergenciaTrecho" ENABLE ROW LEVEL SECURITY;
