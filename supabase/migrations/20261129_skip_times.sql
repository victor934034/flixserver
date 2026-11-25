-- Tempos de abertura e créditos por episódio (em segundos).
-- Preenchida sozinha a partir do IntroDB; correções do admin ficam com manual = true.

CREATE TABLE IF NOT EXISTS episode_skip_times (
  episode_id    uuid        PRIMARY KEY REFERENCES episodes(id) ON DELETE CASCADE,
  intro_start   numeric(8,1),
  intro_end     numeric(8,1),
  credits_start numeric(8,1),
  source        text,
  manual        boolean     NOT NULL DEFAULT false,
  checked_at    timestamptz NOT NULL DEFAULT now()
);
-- RLS ligado sem policies: só o backend (service role) acessa.
ALTER TABLE episode_skip_times ENABLE ROW LEVEL SECURITY;
