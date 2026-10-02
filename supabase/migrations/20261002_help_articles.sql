-- Artigos de ajuda/FAQ geridos pelo admin, exibidos na tela de Ajuda do app/site.
CREATE TABLE IF NOT EXISTS help_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question VARCHAR(200) NOT NULL,
  answer TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_help_articles_is_active ON help_articles(is_active, order_index);

ALTER TABLE help_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_articles_public_read" ON help_articles
  FOR SELECT USING (is_active = true);
