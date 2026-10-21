-- Regra de proteção do Bolsa Família atualizada pela Portaria MDS nº 1.084/2025 (a partir de junho/2025):
-- teto fixo de R$ 706 por pessoa e permanência de 12 meses para quem entra na regra a partir dessa data.
-- Remove os valores automáticos de "meio salário mínimo" de 2026 em diante (só os criados pelo sistema,
-- nunca os digitados pelo consultor) e cria a nova vigência sem apagar o histórico.
DELETE FROM "Parametro"
WHERE "chave" = 'BF_PROTECAO_LIMITE'
  AND "vigenciaInicio" >= DATE '2025-06-01'
  AND ("observacao" = 'Migrado da tabela anual' OR "observacao" LIKE 'Meio salário mínimo (padrão)%');

INSERT INTO "Parametro" ("id", "chave", "valor", "vigenciaInicio", "fonteUrl", "observacao", "atualizadoEm")
VALUES
  (gen_random_uuid()::text, 'BF_PROTECAO_LIMITE', to_jsonb(706), DATE '2025-06-01', 'https://www.gov.br/mds/pt-br/acoes-e-programas/bolsa-familia', 'Portaria MDS nº 1.084/2025: teto fixo de R$ 706 por pessoa.', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'BF_PROTECAO_MESES', to_jsonb(12), DATE '2025-06-01', 'https://www.gov.br/mds/pt-br/acoes-e-programas/bolsa-familia', 'Portaria MDS nº 1.084/2025: 12 meses para quem entra na regra a partir de jun/2025 (quem já estava segue com até 24).', CURRENT_TIMESTAMP)
ON CONFLICT ("chave", "vigenciaInicio") DO NOTHING;
