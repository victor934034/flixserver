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

-- >>> 20261121_payment_providers
-- Alternância entre Mercado Pago e Asaas, mantendo o gateway de origem no histórico.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'asaas';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_preference_id text;
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_remote_unique
  ON payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

UPDATE payments
SET provider = 'asaas', provider_payment_id = asaas_payment_id
WHERE asaas_payment_id IS NOT NULL AND provider_payment_id IS NULL;

ALTER TABLE iptv_orders ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE iptv_orders ADD COLUMN IF NOT EXISTS provider_payment_id text;

INSERT INTO system_settings (key, value)
VALUES ('payment_provider', 'mercado_pago')
ON CONFLICT (key) DO NOTHING;

-- Planos IPTV completos: preços e ordem, tudo a partir dos 4 planos de 1 mês de base:
--   sem adulto 11,90 · sem adulto 2 telas 16,90 · com adulto 17,90 · com adulto 2 telas 20,90
-- 3, 6 e 12 meses seguem a mesma proporção dos de 1 mês (~2,5x / ~4,6x / ~8,4x).
-- Pode rodar mais de uma vez: insere o que falta e depois acerta preço, ordem e status.
-- O P2PRO repete os preços do ONE X e fica INATIVO até você ligar em /admin/iptv.

INSERT INTO iptv_plans (name, description, price, duration_months, is_active, order_index, is_adult, max_streams)
SELECT v.name, v.description, v.price, v.duration_months, v.is_active, v.order_index, v.is_adult, v.max_streams
FROM (VALUES
  ('[ONE X] PACOTE 1 MÊS SEM ADULTO', '1 conexão · canais ao vivo, filmes e séries', 11.90::numeric, 1, true, 0, false, 1),
  ('[ONE X] PACOTE 1 MÊS SEM ADULTO 2 TELAS', '2 conexões ao mesmo tempo', 16.90::numeric, 1, true, 1, false, 2),
  ('[ONE X] PACOTE 1 MÊS COM ADULTO', '1 conexão · inclui conteúdo adulto (18+)', 17.90::numeric, 1, true, 2, true, 1),
  ('[ONE X] PACOTE 1 MÊS COM ADULTO 2 TELAS', '2 conexões · inclui conteúdo adulto (18+)', 20.90::numeric, 1, true, 3, true, 2),
  ('[ONE X] PACOTE 3 MESES SEM ADULTO', '1 conexão · 3 meses', 29.90::numeric, 3, true, 4, false, 1),
  ('[ONE X] PACOTE 3 MESES COM ADULTO', '1 conexão · 3 meses · inclui conteúdo adulto (18+)', 44.90::numeric, 3, true, 5, true, 1),
  ('[ONE X] PACOTE 6 MESES SEM ADULTO', '1 conexão · 6 meses', 54.90::numeric, 6, true, 6, false, 1),
  ('[ONE X] PACOTE 6 MESES COM ADULTO', '1 conexão · 6 meses · inclui conteúdo adulto (18+)', 82.90::numeric, 6, true, 7, true, 1),
  ('[ONE X] PACOTE 12 MESES SEM ADULTO', '1 conexão · 12 meses', 99.90::numeric, 12, true, 8, false, 1),
  ('[ONE X] PACOTE 12 MESES COM ADULTO', '1 conexão · 12 meses · inclui conteúdo adulto (18+)', 149.90::numeric, 12, true, 9, true, 1),
  ('[P2PRO] PACOTE 1 MÊS SEM ADULTO', '1 conexão · canais ao vivo, filmes e séries', 11.90::numeric, 1, false, 10, false, 1),
  ('[P2PRO] PACOTE 1 MÊS SEM ADULTO 2 TELAS', '2 conexões ao mesmo tempo', 16.90::numeric, 1, false, 11, false, 2),
  ('[P2PRO] PACOTE 1 MÊS COM ADULTO', '1 conexão · inclui conteúdo adulto (18+)', 17.90::numeric, 1, false, 12, true, 1),
  ('[P2PRO] PACOTE 1 MÊS COM ADULTO 2 TELAS', '2 conexões · inclui conteúdo adulto (18+)', 20.90::numeric, 1, false, 13, true, 2),
  ('[P2PRO] PACOTE 3 MESES SEM ADULTO', '1 conexão · 3 meses', 29.90::numeric, 3, false, 14, false, 1),
  ('[P2PRO] PACOTE 3 MESES COM ADULTO', '1 conexão · 3 meses · inclui conteúdo adulto (18+)', 44.90::numeric, 3, false, 15, true, 1),
  ('[P2PRO] PACOTE 6 MESES SEM ADULTO', '1 conexão · 6 meses', 54.90::numeric, 6, false, 16, false, 1),
  ('[P2PRO] PACOTE 6 MESES COM ADULTO', '1 conexão · 6 meses · inclui conteúdo adulto (18+)', 82.90::numeric, 6, false, 17, true, 1),
  ('[P2PRO] PACOTE 12 MESES SEM ADULTO', '1 conexão · 12 meses', 99.90::numeric, 12, false, 18, false, 1),
  ('[P2PRO] PACOTE 12 MESES COM ADULTO', '1 conexão · 12 meses · inclui conteúdo adulto (18+)', 149.90::numeric, 12, false, 19, true, 1)
) AS v(name, description, price, duration_months, is_active, order_index, is_adult, max_streams)
WHERE NOT EXISTS (SELECT 1 FROM iptv_plans p WHERE p.name = v.name);

-- Acerta preço e ordem de tudo; liga o ONE X (o P2PRO só mexe em preço/ordem, não no status)
UPDATE iptv_plans SET price = 11.90, order_index = 0, is_active = true WHERE name = '[ONE X] PACOTE 1 MÊS SEM ADULTO';
UPDATE iptv_plans SET price = 16.90, order_index = 1, is_active = true WHERE name = '[ONE X] PACOTE 1 MÊS SEM ADULTO 2 TELAS';
UPDATE iptv_plans SET price = 17.90, order_index = 2, is_active = true WHERE name = '[ONE X] PACOTE 1 MÊS COM ADULTO';
UPDATE iptv_plans SET price = 20.90, order_index = 3, is_active = true WHERE name = '[ONE X] PACOTE 1 MÊS COM ADULTO 2 TELAS';
UPDATE iptv_plans SET price = 29.90, order_index = 4, is_active = true WHERE name = '[ONE X] PACOTE 3 MESES SEM ADULTO';
UPDATE iptv_plans SET price = 44.90, order_index = 5, is_active = true WHERE name = '[ONE X] PACOTE 3 MESES COM ADULTO';
UPDATE iptv_plans SET price = 54.90, order_index = 6, is_active = true WHERE name = '[ONE X] PACOTE 6 MESES SEM ADULTO';
UPDATE iptv_plans SET price = 82.90, order_index = 7, is_active = true WHERE name = '[ONE X] PACOTE 6 MESES COM ADULTO';
UPDATE iptv_plans SET price = 99.90, order_index = 8, is_active = true WHERE name = '[ONE X] PACOTE 12 MESES SEM ADULTO';
UPDATE iptv_plans SET price = 149.90, order_index = 9, is_active = true WHERE name = '[ONE X] PACOTE 12 MESES COM ADULTO';
UPDATE iptv_plans SET price = 11.90, order_index = 10 WHERE name = '[P2PRO] PACOTE 1 MÊS SEM ADULTO';
UPDATE iptv_plans SET price = 16.90, order_index = 11 WHERE name = '[P2PRO] PACOTE 1 MÊS SEM ADULTO 2 TELAS';
UPDATE iptv_plans SET price = 17.90, order_index = 12 WHERE name = '[P2PRO] PACOTE 1 MÊS COM ADULTO';
UPDATE iptv_plans SET price = 20.90, order_index = 13 WHERE name = '[P2PRO] PACOTE 1 MÊS COM ADULTO 2 TELAS';
UPDATE iptv_plans SET price = 29.90, order_index = 14 WHERE name = '[P2PRO] PACOTE 3 MESES SEM ADULTO';
UPDATE iptv_plans SET price = 44.90, order_index = 15 WHERE name = '[P2PRO] PACOTE 3 MESES COM ADULTO';
UPDATE iptv_plans SET price = 54.90, order_index = 16 WHERE name = '[P2PRO] PACOTE 6 MESES SEM ADULTO';
UPDATE iptv_plans SET price = 82.90, order_index = 17 WHERE name = '[P2PRO] PACOTE 6 MESES COM ADULTO';
UPDATE iptv_plans SET price = 99.90, order_index = 18 WHERE name = '[P2PRO] PACOTE 12 MESES SEM ADULTO';
UPDATE iptv_plans SET price = 149.90, order_index = 19 WHERE name = '[P2PRO] PACOTE 12 MESES COM ADULTO';
