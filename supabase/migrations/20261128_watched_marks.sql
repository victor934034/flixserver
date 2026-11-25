-- "Marcar como já assistido": tabela própria, pra não encher o histórico
-- (uma série longa viraria centenas de linhas) nem contar no Top 10.

CREATE TABLE IF NOT EXISTS watched_marks (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id   uuid,
  content_type text        NOT NULL CHECK (content_type IN ('movie','series')),
  content_id   uuid        NOT NULL,
  created_at   timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS watched_marks_profile_idx
  ON watched_marks (user_id, profile_id, content_type, content_id) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS watched_marks_noprofile_idx
  ON watched_marks (user_id, content_type, content_id) WHERE profile_id IS NULL;
-- RLS ligado sem policies: só o backend (service role) acessa.
ALTER TABLE watched_marks ENABLE ROW LEVEL SECURITY;
