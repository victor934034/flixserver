-- SEGURANÇA: liga Row Level Security em TODAS as tabelas do schema public.
-- Sem policies = a chave anon/pública não lê nem escreve nada. O backend usa a
-- service role key, que ignora RLS, então nada do app muda.
-- (iptv_credentials, iptv_orders e iptv_plans estavam com RLS DESLIGADO — com a
-- chave anon qualquer pessoa conseguiria ler usuário/senha de IPTV.)
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
