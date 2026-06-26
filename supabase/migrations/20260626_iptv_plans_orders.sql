-- Planos IPTV configurados pelo admin
CREATE TABLE IF NOT EXISTS iptv_plans (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text        NOT NULL,
  description text,
  price       numeric(10,2) NOT NULL,
  duration_months int     NOT NULL DEFAULT 1,
  is_active   boolean     DEFAULT true,
  order_index int         DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Pedidos IPTV aprovados aguardando ativação manual
CREATE TABLE IF NOT EXISTS iptv_orders (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid        REFERENCES users(id) ON DELETE CASCADE,
  user_name      text,
  user_email     text,
  plan_id        uuid,
  plan_name      text        NOT NULL,
  amount         numeric(10,2) NOT NULL,
  mp_payment_id  text,
  status         text        DEFAULT 'pending', -- pending | activated | cancelled
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS iptv_orders_user_id_idx ON iptv_orders (user_id);
CREATE INDEX IF NOT EXISTS iptv_orders_status_idx  ON iptv_orders (status);

ALTER TABLE iptv_plans  DISABLE ROW LEVEL SECURITY;
ALTER TABLE iptv_orders DISABLE ROW LEVEL SECURITY;
