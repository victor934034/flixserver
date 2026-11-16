-- Chat ao vivo entre usuário e admin (suporte). Uma conversa por usuário:
-- as mensagens do usuário e as respostas do admin ficam todas aqui.
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'admin')),
  body TEXT NOT NULL DEFAULT '',
  attachment_url TEXT,
  attachment_type VARCHAR(10) CHECK (attachment_type IN ('image', 'video', 'file')),
  attachment_name TEXT,
  attachment_size BIGINT,
  is_read BOOLEAN DEFAULT false,   -- lida pelo destinatário
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_user ON support_messages(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_messages_created ON support_messages(created_at DESC);

-- Só o backend (service key) acessa; sem leitura pública.
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
