-- Data real de lançamento (TMDB) para "Recém lançados" e filtros por data
ALTER TABLE movies ADD COLUMN IF NOT EXISTS release_date date;
ALTER TABLE series ADD COLUMN IF NOT EXISTS release_date date;
CREATE INDEX IF NOT EXISTS movies_release_date_idx ON movies (release_date DESC);
CREATE INDEX IF NOT EXISTS series_release_date_idx ON series (release_date DESC);
