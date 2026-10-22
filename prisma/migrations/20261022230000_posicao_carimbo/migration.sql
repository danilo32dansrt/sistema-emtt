-- CreateTable
CREATE TABLE "PosicaoCarimbo" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pagina" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosicaoCarimbo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PosicaoCarimbo_documentoId_usuarioId_key" ON "PosicaoCarimbo"("documentoId", "usuarioId");

-- AddForeignKey
ALTER TABLE "PosicaoCarimbo" ADD CONSTRAINT "PosicaoCarimbo_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosicaoCarimbo" ADD CONSTRAINT "PosicaoCarimbo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PosicaoCarimbo" ENABLE ROW LEVEL SECURITY;
