-- Tabela de credenciais IPTV (Xtream Codes) por usuário
-- Execute no painel SQL do Supabase

CREATE TABLE IF NOT EXISTS iptv_credentials (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  server_url  text        NOT NULL,
  xc_username text        NOT NULL,
  xc_password text        NOT NULL,
  active      boolean     DEFAULT true,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Índice para busca rápida por usuário
CREATE INDEX IF NOT EXISTS iptv_credentials_user_id_idx ON iptv_credentials (user_id);

-- RLS: desabilita para o backend usar service_role
ALTER TABLE iptv_credentials DISABLE ROW LEVEL SECURITY;
