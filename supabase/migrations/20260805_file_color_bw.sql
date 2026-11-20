-- Adiciona colunas file_color e file_bw usadas pela API de filmes e episodios
-- desde o commit afdba2f (estavam ausentes do banco, quebrando a listagem de filmes)

ALTER TABLE movies ADD COLUMN IF NOT EXISTS file_color TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS file_bw TEXT;

ALTER TABLE episodes ADD COLUMN IF NOT EXISTS file_color TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS file_bw TEXT;
