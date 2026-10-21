-- CreateTable
CREATE TABLE "InscricaoPush" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InscricaoPush_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "link" TEXT,
    "lidaEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InscricaoPush_endpoint_key" ON "InscricaoPush"("endpoint");

-- CreateIndex
CREATE INDEX "InscricaoPush_usuarioId_idx" ON "InscricaoPush"("usuarioId");

-- CreateIndex
CREATE INDEX "Notificacao_usuarioId_lidaEm_idx" ON "Notificacao"("usuarioId", "lidaEm");

-- CreateIndex
CREATE UNIQUE INDEX "Notificacao_usuarioId_chave_key" ON "Notificacao"("usuarioId", "chave");

-- AddForeignKey
ALTER TABLE "InscricaoPush" ADD CONSTRAINT "InscricaoPush_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Segurança: a API pública do Supabase não lê estas tabelas (acesso só pelo servidor)
ALTER TABLE "InscricaoPush" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notificacao" ENABLE ROW LEVEL SECURITY;
