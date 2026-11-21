-- Novos planos IPTV (painel ONE X) + vínculo com os pacotes do painel (Sigma)
ALTER TABLE iptv_plans ADD COLUMN IF NOT EXISTS is_adult boolean DEFAULT false;
ALTER TABLE iptv_plans ADD COLUMN IF NOT EXISTS max_streams integer DEFAULT 1;
ALTER TABLE iptv_plans ADD COLUMN IF NOT EXISTS sigma_package_id text;
ALTER TABLE iptv_plans ADD COLUMN IF NOT EXISTS sigma_server_id text;

-- Tira os planos antigos e coloca os novos (pedidos antigos guardam o nome do plano, não dependem da linha)
DELETE FROM iptv_plans;

INSERT INTO iptv_plans (name, description, price, duration_months, is_active, order_index, is_adult, max_streams) VALUES
  ('[ONE X] PACOTE 1 MÊS SEM ADULTO',          '1 conexão · canais ao vivo, filmes e séries',          24.90,  1,  true, 0, false, 1),
  ('[ONE X] PACOTE 1 MÊS SEM ADULTO 2 TELAS',  '2 conexões ao mesmo tempo',                            39.90,  1,  true, 1, false, 2),
  ('[ONE X] PACOTE 1 MÊS COM ADULTO',          '1 conexão · inclui conteúdo adulto (18+)',             27.90,  1,  true, 2, true,  1),
  ('[ONE X] PACOTE 3 MESES SEM ADULTO',        '1 conexão · 3 meses',                                  54.90,  3,  true, 3, false, 1),
  ('[ONE X] PACOTE 3 MESES COM ADULTO',        '1 conexão · 3 meses · inclui conteúdo adulto (18+)',   57.90,  3,  true, 4, true,  1),
  ('[ONE X] PACOTE 6 MESES SEM ADULTO',        '1 conexão · 6 meses',                                  109.90, 6,  true, 5, false, 1),
  ('[ONE X] PACOTE 6 MESES COM ADULTO',        '1 conexão · 6 meses · inclui conteúdo adulto (18+)',   114.90, 6,  true, 6, true,  1),
  ('[ONE X] PACOTE 12 MESES SEM ADULTO',       '1 conexão · 12 meses',                                 159.90, 12, true, 7, false, 1),
  ('[ONE X] PACOTE 12 MESES COM ADULTO',       '1 conexão · 12 meses · inclui conteúdo adulto (18+)',  164.90, 12, true, 8, true,  1);
