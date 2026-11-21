-- Planos IPTV completos: preços e ordem, tudo a partir dos 4 planos de 1 mês de base:
--   sem adulto 11,90 · sem adulto 2 telas 16,90 · com adulto 17,90 · com adulto 2 telas 20,90
-- 3, 6 e 12 meses seguem a mesma proporção dos de 1 mês (~2,5x / ~4,6x / ~8,4x).
-- Pode rodar mais de uma vez: insere o que falta e depois acerta preço, ordem e status.
-- O P2PRO repete os preços do ONE X e fica INATIVO até você ligar em /admin/iptv.

INSERT INTO iptv_plans (name, description, price, duration_months, is_active, order_index, is_adult, max_streams)
SELECT v.name, v.description, v.price, v.duration_months, v.is_active, v.order_index, v.is_adult, v.max_streams
FROM (VALUES
  ('[ONE X] PACOTE 1 MÊS SEM ADULTO', '1 conexão · canais ao vivo, filmes e séries', 11.90::numeric, 1, true, 0, false, 1),
  ('[ONE X] PACOTE 1 MÊS SEM ADULTO 2 TELAS', '2 conexões ao mesmo tempo', 16.90::numeric, 1, true, 1, false, 2),
  ('[ONE X] PACOTE 1 MÊS COM ADULTO', '1 conexão · inclui conteúdo adulto (18+)', 17.90::numeric, 1, true, 2, true, 1),
  ('[ONE X] PACOTE 1 MÊS COM ADULTO 2 TELAS', '2 conexões · inclui conteúdo adulto (18+)', 20.90::numeric, 1, true, 3, true, 2),
  ('[ONE X] PACOTE 3 MESES SEM ADULTO', '1 conexão · 3 meses', 29.90::numeric, 3, true, 4, false, 1),
  ('[ONE X] PACOTE 3 MESES COM ADULTO', '1 conexão · 3 meses · inclui conteúdo adulto (18+)', 44.90::numeric, 3, true, 5, true, 1),
  ('[ONE X] PACOTE 6 MESES SEM ADULTO', '1 conexão · 6 meses', 54.90::numeric, 6, true, 6, false, 1),
  ('[ONE X] PACOTE 6 MESES COM ADULTO', '1 conexão · 6 meses · inclui conteúdo adulto (18+)', 82.90::numeric, 6, true, 7, true, 1),
  ('[ONE X] PACOTE 12 MESES SEM ADULTO', '1 conexão · 12 meses', 99.90::numeric, 12, true, 8, false, 1),
  ('[ONE X] PACOTE 12 MESES COM ADULTO', '1 conexão · 12 meses · inclui conteúdo adulto (18+)', 149.90::numeric, 12, true, 9, true, 1),
  ('[P2PRO] PACOTE 1 MÊS SEM ADULTO', '1 conexão · canais ao vivo, filmes e séries', 11.90::numeric, 1, false, 10, false, 1),
  ('[P2PRO] PACOTE 1 MÊS SEM ADULTO 2 TELAS', '2 conexões ao mesmo tempo', 16.90::numeric, 1, false, 11, false, 2),
  ('[P2PRO] PACOTE 1 MÊS COM ADULTO', '1 conexão · inclui conteúdo adulto (18+)', 17.90::numeric, 1, false, 12, true, 1),
  ('[P2PRO] PACOTE 1 MÊS COM ADULTO 2 TELAS', '2 conexões · inclui conteúdo adulto (18+)', 20.90::numeric, 1, false, 13, true, 2),
  ('[P2PRO] PACOTE 3 MESES SEM ADULTO', '1 conexão · 3 meses', 29.90::numeric, 3, false, 14, false, 1),
  ('[P2PRO] PACOTE 3 MESES COM ADULTO', '1 conexão · 3 meses · inclui conteúdo adulto (18+)', 44.90::numeric, 3, false, 15, true, 1),
  ('[P2PRO] PACOTE 6 MESES SEM ADULTO', '1 conexão · 6 meses', 54.90::numeric, 6, false, 16, false, 1),
  ('[P2PRO] PACOTE 6 MESES COM ADULTO', '1 conexão · 6 meses · inclui conteúdo adulto (18+)', 82.90::numeric, 6, false, 17, true, 1),
  ('[P2PRO] PACOTE 12 MESES SEM ADULTO', '1 conexão · 12 meses', 99.90::numeric, 12, false, 18, false, 1),
  ('[P2PRO] PACOTE 12 MESES COM ADULTO', '1 conexão · 12 meses · inclui conteúdo adulto (18+)', 149.90::numeric, 12, false, 19, true, 1)
) AS v(name, description, price, duration_months, is_active, order_index, is_adult, max_streams)
WHERE NOT EXISTS (SELECT 1 FROM iptv_plans p WHERE p.name = v.name);

-- Acerta preço e ordem de tudo; liga o ONE X (o P2PRO só mexe em preço/ordem, não no status)
UPDATE iptv_plans SET price = 11.90, order_index = 0, is_active = true WHERE name = '[ONE X] PACOTE 1 MÊS SEM ADULTO';
UPDATE iptv_plans SET price = 16.90, order_index = 1, is_active = true WHERE name = '[ONE X] PACOTE 1 MÊS SEM ADULTO 2 TELAS';
UPDATE iptv_plans SET price = 17.90, order_index = 2, is_active = true WHERE name = '[ONE X] PACOTE 1 MÊS COM ADULTO';
UPDATE iptv_plans SET price = 20.90, order_index = 3, is_active = true WHERE name = '[ONE X] PACOTE 1 MÊS COM ADULTO 2 TELAS';
UPDATE iptv_plans SET price = 29.90, order_index = 4, is_active = true WHERE name = '[ONE X] PACOTE 3 MESES SEM ADULTO';
UPDATE iptv_plans SET price = 44.90, order_index = 5, is_active = true WHERE name = '[ONE X] PACOTE 3 MESES COM ADULTO';
UPDATE iptv_plans SET price = 54.90, order_index = 6, is_active = true WHERE name = '[ONE X] PACOTE 6 MESES SEM ADULTO';
UPDATE iptv_plans SET price = 82.90, order_index = 7, is_active = true WHERE name = '[ONE X] PACOTE 6 MESES COM ADULTO';
UPDATE iptv_plans SET price = 99.90, order_index = 8, is_active = true WHERE name = '[ONE X] PACOTE 12 MESES SEM ADULTO';
UPDATE iptv_plans SET price = 149.90, order_index = 9, is_active = true WHERE name = '[ONE X] PACOTE 12 MESES COM ADULTO';
UPDATE iptv_plans SET price = 11.90, order_index = 10 WHERE name = '[P2PRO] PACOTE 1 MÊS SEM ADULTO';
UPDATE iptv_plans SET price = 16.90, order_index = 11 WHERE name = '[P2PRO] PACOTE 1 MÊS SEM ADULTO 2 TELAS';
UPDATE iptv_plans SET price = 17.90, order_index = 12 WHERE name = '[P2PRO] PACOTE 1 MÊS COM ADULTO';
UPDATE iptv_plans SET price = 20.90, order_index = 13 WHERE name = '[P2PRO] PACOTE 1 MÊS COM ADULTO 2 TELAS';
UPDATE iptv_plans SET price = 29.90, order_index = 14 WHERE name = '[P2PRO] PACOTE 3 MESES SEM ADULTO';
UPDATE iptv_plans SET price = 44.90, order_index = 15 WHERE name = '[P2PRO] PACOTE 3 MESES COM ADULTO';
UPDATE iptv_plans SET price = 54.90, order_index = 16 WHERE name = '[P2PRO] PACOTE 6 MESES SEM ADULTO';
UPDATE iptv_plans SET price = 82.90, order_index = 17 WHERE name = '[P2PRO] PACOTE 6 MESES COM ADULTO';
UPDATE iptv_plans SET price = 99.90, order_index = 18 WHERE name = '[P2PRO] PACOTE 12 MESES SEM ADULTO';
UPDATE iptv_plans SET price = 149.90, order_index = 19 WHERE name = '[P2PRO] PACOTE 12 MESES COM ADULTO';
