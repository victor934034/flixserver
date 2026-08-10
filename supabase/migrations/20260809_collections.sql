-- Coleções / Cronologias (ex: "Universo Marvel em ordem cronológica")
-- Permite agrupar filmes e séries numa ordem customizada, exibida no site/app.

CREATE TABLE IF NOT EXISTS collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) UNIQUE NOT NULL,
  description TEXT,
  cover_url TEXT,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collection_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  content_type VARCHAR(10) NOT NULL CHECK (content_type IN ('movie', 'series')),
  content_id UUID NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  note VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (collection_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_id, position);
CREATE INDEX IF NOT EXISTS idx_collections_is_active ON collections(is_active);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collections_public_read" ON collections
  FOR SELECT USING (is_active = true);

CREATE POLICY "collection_items_public_read" ON collection_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_items.collection_id AND c.is_active = true)
  );
