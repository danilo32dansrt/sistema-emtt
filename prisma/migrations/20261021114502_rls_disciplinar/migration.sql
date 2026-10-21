-- Bloqueia a API pública do Supabase nesta tabela (acesso só pelo servidor).
ALTER TABLE "OcorrenciaDisciplinar" ENABLE ROW LEVEL SECURITY;
