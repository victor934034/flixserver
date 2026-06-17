-- Execute este arquivo no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS movies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tmdb_id INTEGER UNIQUE,
  title VARCHAR(500) NOT NULL,
  original_title VARCHAR(500),
  synopsis TEXT,
  year INTEGER,
  duration INTEGER,
  rating DECIMAL(3,1),
  genres TEXT[],
  poster_url TEXT,
  backdrop_url TEXT,
  trailer_url TEXT,
  category VARCHAR(100) DEFAULT 'movie',
  age_rating VARCHAR(10),
  language VARCHAR(10) DEFAULT 'pt-BR',
  file_dubbing TEXT,
  file_subtitled TEXT,
  file_cinema TEXT,
  file_4k TEXT,
  subtitle_pt TEXT,
  subtitle_en TEXT,
  subtitle_es TEXT,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  featured_order INTEGER,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS series (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tmdb_id INTEGER UNIQUE,
  title VARCHAR(500) NOT NULL,
  original_title VARCHAR(500),
  synopsis TEXT,
  year_start INTEGER,
  year_end INTEGER,
  total_seasons INTEGER,
  rating DECIMAL(3,1),
  genres TEXT[],
  poster_url TEXT,
  backdrop_url TEXT,
  trailer_url TEXT,
  age_rating VARCHAR(10),
  language VARCHAR(10) DEFAULT 'pt-BR',
  status VARCHAR(50) DEFAULT 'ongoing',
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  featured_order INTEGER,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS episodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id UUID REFERENCES series(id) ON DELETE CASCADE,
  tmdb_episode_id INTEGER,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  title VARCHAR(500),
  synopsis TEXT,
  duration INTEGER,
  thumbnail_url TEXT,
  file_dubbing TEXT,
  file_subtitled TEXT,
  file_cinema TEXT,
  subtitle_pt TEXT,
  subtitle_en TEXT,
  subtitle_es TEXT,
  air_date DATE,
  is_active BOOLEAN DEFAULT true,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(series_id, season_number, episode_number)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  plan VARCHAR(50) DEFAULT 'free',
  plan_expires_at TIMESTAMPTZ,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watch_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(10),
  content_id UUID,
  episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,
  progress INTEGER DEFAULT 0,
  duration INTEGER,
  completed BOOLEAN DEFAULT false,
  last_watched TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_id, episode_id)
);

CREATE TABLE IF NOT EXISTS watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(10),
  content_id UUID,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE,
  type VARCHAR(20) DEFAULT 'both',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_movies_is_active ON movies(is_active);
CREATE INDEX IF NOT EXISTS idx_movies_is_featured ON movies(is_featured);
CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year);
CREATE INDEX IF NOT EXISTS idx_series_is_active ON series(is_active);
CREATE INDEX IF NOT EXISTS idx_episodes_series_id ON episodes(series_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_user_id ON watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);

-- Função para incrementar views
CREATE OR REPLACE FUNCTION increment_views(table_name TEXT, record_id UUID)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE %I SET views = views + 1 WHERE id = $1', table_name)
  USING record_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER movies_updated_at BEFORE UPDATE ON movies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER series_updated_at BEFORE UPDATE ON series
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Políticas RLS (Row Level Security)
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Leitura pública para conteúdo ativo (service_key ignora RLS)
CREATE POLICY "movies_public_read" ON movies FOR SELECT USING (is_active = true);
CREATE POLICY "series_public_read" ON series FOR SELECT USING (is_active = true);
CREATE POLICY "episodes_public_read" ON episodes FOR SELECT USING (is_active = true);
CREATE POLICY "categories_public_read" ON categories FOR SELECT USING (is_active = true);
