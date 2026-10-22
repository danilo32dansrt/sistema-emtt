-- CreateTable
CREATE TABLE "TratamentoDia" (
    "id" TEXT NOT NULL,
    "empregadoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tratamento" TEXT NOT NULL,
    "motivo" TEXT,
    "decididoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TratamentoDia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TratamentoDia_empregadoId_data_key" ON "TratamentoDia"("empregadoId", "data");

-- AddForeignKey
ALTER TABLE "TratamentoDia" ADD CONSTRAINT "TratamentoDia_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "Empregado"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Segurança: a API pública do Supabase não lê esta tabela (acesso só pelo servidor)
ALTER TABLE "TratamentoDia" ENABLE ROW LEVEL SECURITY;
