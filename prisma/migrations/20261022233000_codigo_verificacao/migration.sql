-- Código de verificação curto do documento (impresso no carimbo e no QR Code): 4 letras + 6 números, ex.: DJSD586588.
-- Sem I e O (confundem com 1 e 0). Sorteado com gen_random_uuid() (gerador seguro), para não ser adivinhável.
CREATE OR REPLACE FUNCTION gerar_codigo_verificacao() RETURNS TEXT AS $$
DECLARE
  letras CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  u TEXT := replace(gen_random_uuid()::text, '-', '');
  c TEXT := '';
  i INT;
BEGIN
  FOR i IN 0..3 LOOP
    c := c || substr(letras, 1 + (('x' || substr(u, i * 2 + 1, 2))::bit(8)::int % 24), 1);
  END LOOP;
  RETURN c || lpad(((('x' || substr(u, 17, 8))::bit(32)::bigint) % 1000000)::text, 6, '0');
END
$$ LANGUAGE plpgsql VOLATILE;

ALTER TABLE "Documento" ADD COLUMN "codigoVerificacao" TEXT;
UPDATE "Documento" SET "codigoVerificacao" = gerar_codigo_verificacao();
ALTER TABLE "Documento" ALTER COLUMN "codigoVerificacao" SET NOT NULL;
ALTER TABLE "Documento" ALTER COLUMN "codigoVerificacao" SET DEFAULT gerar_codigo_verificacao();
CREATE UNIQUE INDEX "Documento_codigoVerificacao_key" ON "Documento"("codigoVerificacao");
