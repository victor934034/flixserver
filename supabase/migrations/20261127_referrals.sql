-- Indique um amigo: quem indica ganha dias grátis quando o amigo paga um plano.

ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code text;
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_idx ON users (referral_code);

CREATE TABLE IF NOT EXISTS referrals (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id uuid        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, -- cada conta só é indicada uma vez
  reward_days int,
  rewarded_at timestamptz,          -- nulo até o amigo pagar
  created_at  timestamptz DEFAULT now(),
  CHECK (referrer_id <> referred_id)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_id);
-- RLS ligado sem policies: só o backend (service role) acessa.
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Desligado até a assinatura estar no ar (liga no painel admin)
INSERT INTO system_settings (key, value) VALUES
  ('referral_enabled', 'false'),
  ('referral_days', '7')
ON CONFLICT (key) DO NOTHING;
