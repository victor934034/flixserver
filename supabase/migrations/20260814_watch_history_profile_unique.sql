-- Corrige o "continuar assistindo" que salvava errado/não salvava.
--
-- Causa: os índices únicos de watch_history (criados antes do recurso de
-- perfis existir) consideram só (user_id, content_id[, episode_id]) — sem
-- profile_id. Como a tabela hoje TEM a coluna profile_id (adicionada fora
-- deste repositório, direto no Supabase), quando um segundo perfil da mesma
-- conta assistia um filme/episódio que outro perfil já tinha no histórico,
-- o INSERT desse segundo perfil violava o índice antigo e falhava
-- silenciosamente (erro 500 engolido no app) — cada perfil "roubava" o
-- histórico do outro.
--
-- Troca por 4 índices parciais (um pra cada combinação de episode_id/
-- profile_id nulo ou não), cobrindo os casos igual o código do backend
-- já trata: filme x episódio, com perfil x sem perfil (site não usa perfil).

DROP INDEX IF EXISTS idx_watch_history_unique;
DROP INDEX IF EXISTS idx_watch_history_unique_ep;

CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_history_uq_movie_profile
  ON watch_history(user_id, content_id, profile_id)
  WHERE episode_id IS NULL AND profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_history_uq_movie_noprofile
  ON watch_history(user_id, content_id)
  WHERE episode_id IS NULL AND profile_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_history_uq_ep_profile
  ON watch_history(user_id, content_id, episode_id, profile_id)
  WHERE episode_id IS NOT NULL AND profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_history_uq_ep_noprofile
  ON watch_history(user_id, content_id, episode_id)
  WHERE episode_id IS NOT NULL AND profile_id IS NULL;
