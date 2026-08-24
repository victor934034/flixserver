-- Preferências de notificação por usuário — permite desligar tipos específicos
-- de push (novo conteúdo / avisos de assinatura e IPTV) sem desativar tudo.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"new_content": true, "billing": true}'::jsonb;
