-- CreateTable
CREATE TABLE "Parametro" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "vigenciaInicio" DATE NOT NULL,
    "fonteUrl" TEXT,
    "ultimaConferencia" DATE,
    "observacao" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parametro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FonteOficial" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "hash" TEXT,
    "verificadaEm" TIMESTAMP(3),
    "mudouEm" TIMESTAMP(3),
    "erro" TEXT,

    CONSTRAINT "FonteOficial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Parametro_chave_idx" ON "Parametro"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "Parametro_chave_vigenciaInicio_key" ON "Parametro"("chave", "vigenciaInicio");

-- CreateIndex
CREATE UNIQUE INDEX "FonteOficial_url_key" ON "FonteOficial"("url");


-- Copia os valores da antiga tabela anual para a tabela de parâmetros (vigência em 1º de janeiro)
INSERT INTO "Parametro" ("id", "chave", "valor", "vigenciaInicio", "observacao", "atualizadoEm")
SELECT gen_random_uuid()::text, p.chave, p.valor, make_date(t."ano", 1, 1), 'Migrado da tabela anual', CURRENT_TIMESTAMP
FROM "TabelaAnual" t
CROSS JOIN LATERAL (VALUES
  ('SALARIO_MINIMO', to_jsonb(t."salarioMinimo")),
  ('INSS_FAIXAS', t."faixasInss"::jsonb),
  ('SALARIO_FAMILIA_LIMITE', to_jsonb(t."salarioFamiliaLimite")),
  ('SALARIO_FAMILIA_COTA', to_jsonb(t."salarioFamiliaCota")),
  ('BF_PROTECAO_LIMITE', to_jsonb(round(t."salarioMinimo" / 2, 2)))
) AS p(chave, valor)
ON CONFLICT DO NOTHING;

INSERT INTO "Parametro" ("id", "chave", "valor", "vigenciaInicio", "observacao", "atualizadoEm")
SELECT gen_random_uuid()::text, 'DAE_SELIC_MENSAL', to_jsonb(c."selicMensal"), DATE '2024-01-01', 'Migrado das configurações', CURRENT_TIMESTAMP
FROM "Configuracao" c WHERE c.id = 'principal'
ON CONFLICT DO NOTHING;

ALTER TABLE "Configuracao" DROP COLUMN "selicMensal";
DROP TABLE "TabelaAnual";

-- Bloqueia a API pública do Supabase nas novas tabelas
ALTER TABLE "Parametro" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FonteOficial" ENABLE ROW LEVEL SECURITY;
