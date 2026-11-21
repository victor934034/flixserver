-- ===== FLIXHOME: rode TUDO isto de uma vez no SQL Editor do Supabase =====

-- >>> 20261120_asaas_trial
-- Asaas (substitui Mercado Pago) + teste grátis

ALTER TABLE users ADD COLUMN IF NOT EXISTS asaas_customer_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used_at timestamptz;

-- Registro de todas as cobranças (plano, IPTV, apoio). Serve de idempotência
-- pro webhook e de base pro "orquestrador" de assinaturas no admin.
CREATE TABLE IF NOT EXISTS payments (
  id               uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid          REFERENCES users(id) ON DELETE CASCADE,
  kind             text          NOT NULL,              -- plan | iptv | donate
  plan_id          text,
  plan_name        text,
  duration_days    int,
  amount           numeric(10,2) NOT NULL,
  method           text,                                -- PIX | CREDIT_CARD | BOLETO
  asaas_payment_id text          UNIQUE,
  status           text          DEFAULT 'PENDING',     -- PENDING | CONFIRMED | RECEIVED | OVERDUE | REFUNDED | ...
  invoice_url      text,
  fulfilled_at     timestamptz,
  created_at       timestamptz   DEFAULT now(),
  updated_at       timestamptz   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_user_idx   ON payments (user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status);
-- RLS ligado sem policies: só o backend (service role) acessa.
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE iptv_orders ADD COLUMN IF NOT EXISTS asaas_payment_id text;

-- Configuração do teste grátis (editável no admin)
INSERT INTO system_settings (key, value) VALUES
  ('trial_enabled', 'false'),
  ('trial_days', '7'),
  ('trial_auto_signup', 'false')
ON CONFLICT (key) DO NOTHING;

-- >>> 20261120_security_rls
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

-- >>> 20261121_trial_security
-- Anti-abuso do teste grátis + bloqueio por IP / dispositivo

-- Cada teste grátis concedido (um por dispositivo; em PC/web também por IP)
CREATE TABLE IF NOT EXISTS trial_claims (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES users(id) ON DELETE CASCADE,
  device_hash text,                 -- sha256 do ID do aparelho (nunca o ID cru)
  ip          text,
  platform    text,                 -- android | ios | tv | web
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trial_claims_device_idx ON trial_claims (device_hash);
CREATE INDEX IF NOT EXISTS trial_claims_ip_idx     ON trial_claims (ip);
CREATE INDEX IF NOT EXISTS trial_claims_user_idx   ON trial_claims (user_id);
ALTER TABLE trial_claims ENABLE ROW LEVEL SECURITY;

-- Lista de bloqueio gerenciada pelo admin
CREATE TABLE IF NOT EXISTS blocked_entries (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  kind       text        NOT NULL CHECK (kind IN ('ip','device')),
  value      text        NOT NULL,  -- ip (aceita CIDR IPv4, ex 203.0.113.0/24) ou device_hash
  scope      text        NOT NULL DEFAULT 'all' CHECK (scope IN ('all','trial')),
  reason     text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (kind, value)
);
ALTER TABLE blocked_entries ENABLE ROW LEVEL SECURITY;

INSERT INTO system_settings (key, value) VALUES
  ('trial_block_vpn', 'true'),
  ('trial_max_per_ip', '1')
ON CONFLICT (key) DO NOTHING;
-- Data real de lançamento (TMDB) para "Recém lançados" e filtros por data
ALTER TABLE movies ADD COLUMN IF NOT EXISTS release_date date;
ALTER TABLE series ADD COLUMN IF NOT EXISTS release_date date;
CREATE INDEX IF NOT EXISTS movies_release_date_idx ON movies (release_date DESC);
CREATE INDEX IF NOT EXISTS series_release_date_idx ON series (release_date DESC);
-- Banners da Home (separado de "Destaque") com ordem controlada pelo admin
ALTER TABLE movies ADD COLUMN IF NOT EXISTS in_banner boolean DEFAULT false;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS banner_order integer;
ALTER TABLE series ADD COLUMN IF NOT EXISTS in_banner boolean DEFAULT false;
ALTER TABLE series ADD COLUMN IF NOT EXISTS banner_order integer;

-- Quem já estava como destaque (is_featured) continua aparecendo no banner até você reorganizar
UPDATE movies SET in_banner = true, banner_order = COALESCE(featured_order, 99) WHERE is_featured = true AND in_banner IS NOT TRUE;
UPDATE series SET in_banner = true, banner_order = COALESCE(featured_order, 99) WHERE is_featured = true AND in_banner IS NOT TRUE;
-- Novos planos IPTV (painel ONE X) + vínculo com os pacotes do painel (Sigma)
ALTER TABLE iptv_plans ADD COLUMN IF NOT EXISTS is_adult boolean DEFAULT false;
ALTER TABLE iptv_plans ADD COLUMN IF NOT EXISTS max_streams integer DEFAULT 1;
ALTER TABLE iptv_plans ADD COLUMN IF NOT EXISTS sigma_package_id text;
ALTER TABLE iptv_plans ADD COLUMN IF NOT EXISTS sigma_server_id text;

-- Tira os planos antigos e coloca os novos (pedidos antigos guardam o nome do plano, não dependem da linha)
DELETE FROM iptv_plans;

INSERT INTO iptv_plans (name, description, price, duration_months, is_active, order_index, is_adult, max_streams) VALUES
  ('[ONE X] PACOTE 1 MÊS SEM ADULTO',          '1 conexão · canais ao vivo, filmes e séries',          11.90,  1,  true, 0, false, 1),
  ('[ONE X] PACOTE 1 MÊS SEM ADULTO 2 TELAS',  '2 conexões ao mesmo tempo',                            16.90,  1,  true, 1, false, 2),
  ('[ONE X] PACOTE 1 MÊS COM ADULTO',          '1 conexão · inclui conteúdo adulto (18+)',             17.90,  1,  true, 2, true,  1),
  ('[ONE X] PACOTE 3 MESES SEM ADULTO',        '1 conexão · 3 meses',                                  29.90,  3,  true, 3, false, 1),
  ('[ONE X] PACOTE 3 MESES COM ADULTO',        '1 conexão · 3 meses · inclui conteúdo adulto (18+)',   44.90,  3,  true, 4, true,  1),
  ('[ONE X] PACOTE 6 MESES SEM ADULTO',        '1 conexão · 6 meses',                                  54.90, 6,  true, 5, false, 1),
  ('[ONE X] PACOTE 6 MESES COM ADULTO',        '1 conexão · 6 meses · inclui conteúdo adulto (18+)',   82.90, 6,  true, 6, true,  1),
  ('[ONE X] PACOTE 12 MESES SEM ADULTO',       '1 conexão · 12 meses',                                 99.90, 12, true, 7, false, 1),
  ('[ONE X] PACOTE 12 MESES COM ADULTO',       '1 conexão · 12 meses · inclui conteúdo adulto (18+)',  149.90, 12, true, 8, true,  1);
