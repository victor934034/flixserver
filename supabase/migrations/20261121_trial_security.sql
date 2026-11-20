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
