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
