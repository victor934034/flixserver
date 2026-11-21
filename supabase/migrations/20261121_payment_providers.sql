-- Permite alternar novas cobranças entre Mercado Pago e Asaas sem perder o
-- histórico. Cada pagamento guarda o provedor em que foi criado.
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
