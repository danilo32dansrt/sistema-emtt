-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "localDefinidoEm" TIMESTAMP(3),
ADD COLUMN     "localLatitude" DOUBLE PRECISION,
ADD COLUMN     "localLongitude" DOUBLE PRECISION,
ADD COLUMN     "localRaioMetros" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "Empregado" ALTER COLUMN "exigirSelfie" SET DEFAULT false;

-- AlterTable
ALTER TABLE "MarcacaoPonto" ADD COLUMN     "distanciaMetros" DOUBLE PRECISION,
ADD COLUMN     "foraDoLocal" BOOLEAN NOT NULL DEFAULT false;


-- Marcação pelo GPS da casa em vez de selfie (decisão do dono do projeto)
UPDATE "Empregado" SET "exigirSelfie" = false;
