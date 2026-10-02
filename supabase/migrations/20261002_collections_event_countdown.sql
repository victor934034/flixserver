-- Permite marcar uma coleção/cronologia como "evento com contagem regressiva"
-- (ex: "Preparação para Vingadores: Doomsday") — mostra uma contagem embaixo
-- do hero na Home enquanto a data não chega, e some sozinho depois que passar
-- (a consulta de "próximo evento" já filtra event_date >= hoje, sem precisar
-- desativar a coleção manualmente).

ALTER TABLE collections ADD COLUMN IF NOT EXISTS event_date DATE;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS event_label VARCHAR(150);
ALTER TABLE collections ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_collections_event_date ON collections(event_date);
