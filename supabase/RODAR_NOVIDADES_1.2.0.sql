-- ===== Rode tudo de uma vez no SQL Editor do Supabase (novembro/2026) =====

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
-- "Marcar como já assistido": tabela própria, pra não encher o histórico
-- (uma série longa viraria centenas de linhas) nem contar no Top 10.

CREATE TABLE IF NOT EXISTS watched_marks (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id   uuid,
  content_type text        NOT NULL CHECK (content_type IN ('movie','series')),
  content_id   uuid        NOT NULL,
  created_at   timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS watched_marks_profile_idx
  ON watched_marks (user_id, profile_id, content_type, content_id) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS watched_marks_noprofile_idx
  ON watched_marks (user_id, content_type, content_id) WHERE profile_id IS NULL;
-- RLS ligado sem policies: só o backend (service role) acessa.
ALTER TABLE watched_marks ENABLE ROW LEVEL SECURITY;

-- Tempos de abertura e créditos por episódio (em segundos).
-- Preenchida sozinha a partir do IntroDB; correções do admin ficam com manual = true.

CREATE TABLE IF NOT EXISTS episode_skip_times (
  episode_id    uuid        PRIMARY KEY REFERENCES episodes(id) ON DELETE CASCADE,
  intro_start   numeric(8,1),
  intro_end     numeric(8,1),
  credits_start numeric(8,1),
  source        text,
  manual        boolean     NOT NULL DEFAULT false,
  checked_at    timestamptz NOT NULL DEFAULT now()
);
-- RLS ligado sem policies: só o backend (service role) acessa.
ALTER TABLE episode_skip_times ENABLE ROW LEVEL SECURITY;
