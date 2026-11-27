-- Corrige filmes em que Dublado ou Legendado aponta para um .mkv que não existe mais (erro 404).
-- O mesmo filme já tem o .mp4 funcionando na outra versão. Gerado em 26/11/2026, só com casos testados.
-- Cada linha só altera se o endereço antigo ainda for o mesmo, então pode rodar mais de uma vez.
BEGIN;
-- A Freira 2
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/A.Freira.2.2023.1080p.WEB-DL.AAC.EAC3.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/A.Freira.2.2023.1080p.WEB-DL.AAC.EAC3.DUAL.5.1.mkv';
-- A Pequena Sereia
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/A.Pequena.Sereia.2023.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/A.Pequena.Sereia.2023.1080p.WEB-DL.DUAL.5.1.mkv';
-- Amores Materialistas
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Amores.Materialistas.2025.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Amores.Materialistas.2025.1080p.WEB-DL.DUAL.5.1.mkv';
-- Avatar: Fogo e Cinzas
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Avatar.Fogo.e.Cinzas.2025.1080p.WEB-DL.DUAL.8.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Avatar.Fogo.e.Cinzas.2025.1080p.WEB-DL.DUAL.8.1.mkv';
-- Avatar: O Caminho da Água
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Avatar.-.O.Caminho.da.Agua.2023.1080p.WEB-DL.DUAL.7.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Avatar.-.O.Caminho.da.Agua.2023.1080p.WEB-DL.DUAL.7.1.mkv';
-- Bad Boys: Até o Fim
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Bad.Boys.Ate.O.Fim.2024.1080p.WEB-DL.FULL.HD.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Bad.Boys.Ate.O.Fim.2024.1080p.WEB-DL.FULL.HD.DUAL.5.1.mkv';
-- Barbie
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Barbie.2023.1080p.WEB-DL.x264.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Barbie.2023.1080p.WEB-DL.x264.DUAL.5.1.mkv';
-- Bob Marley: One Love
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Bob.Marley.One.Love.2024.1080p.WEB-DL.EAC3.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Bob.Marley.One.Love.2024.1080p.WEB-DL.EAC3.DUAL.5.1.mkv';
-- Borderlands: O Destino do Universo Está em Jogo
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Borderlands.O.Destino.do.Universo.Esta.em.Jogo.2024.1080p.WEB-DL.EAC3.AAC.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Borderlands.O.Destino.do.Universo.Esta.em.Jogo.2024.1080p.WEB-DL.EAC3.AAC.DUAL.5.1.mkv';
-- Coringa: Delírio a Dois
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Coringa.Delirio.a.Dois.2024.1080p.WEB-DL.EAC3.AAC.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Coringa.Delirio.a.Dois.2024.1080p.WEB-DL.EAC3.AAC.DUAL.5.1.mkv';
-- Deadpool & Wolverine
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Deadpool.and.Wolverine.2024.1080p.FULL.HD.WEB-DL.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Deadpool.and.Wolverine.2024.1080p.FULL.HD.WEB-DL.DUAL.5.1.mkv';
-- Dolittle
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Dolittle.2020.1080p.BluRay.x264-DUAL-COMANDO.TO.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Dolittle.2020.1080p.BluRay.x264-DUAL-COMANDO.TO.mkv';
-- Dr. Dolittle 2
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Dr.Dolittle.2.2001.1080p.WEB-DL.H264.5.1.DUAL.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Dr.Dolittle.2.2001.1080p.WEB-DL.H264.5.1.DUAL.mkv';
-- Dr. Dolittle 3
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Dr.Dolittle.3.2006.FULLSCREEN.1080p.WEB-DL.H264.AC3.5.1.DUAL-MLD.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Dr.Dolittle.3.2006.FULLSCREEN.1080p.WEB-DL.H264.AC3.5.1.DUAL-MLD.mkv';
-- Dr. Dolittle 4
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Dr.Dolittle.4.2008.FULLSCREEN.1080p.WEB-DL.H264.AC3.5.1.DUAL-MLD.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Dr.Dolittle.4.2008.FULLSCREEN.1080p.WEB-DL.H264.AC3.5.1.DUAL-MLD.mkv';
-- Enola Holmes 3
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Enola.Holmes.3.2026.WEB-DL.1080p.x264.DUAL.5.1-STARCKFILMES.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Enola.Holmes.3.2026.WEB-DL.1080p.x264.DUAL.5.1-STARCKFILMES.mkv';
-- Garfield - Fora de Casa
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Garfield.Fora.de.Casa.2024.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Garfield.Fora.de.Casa.2024.1080p.WEB-DL.DUAL.5.1.mkv';
-- Ghostbusters: Apocalipse de Gelo
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Ghostbusters.Apocalipse.de.Gelo.2024.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Ghostbusters.Apocalipse.de.Gelo.2024.1080p.WEB-DL.DUAL.5.1.mkv';
-- Gladiador 2
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Gladiator.II.2024.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Gladiator.II.2024.1080p.WEB-DL.DUAL.5.1.mkv';
-- Godzilla e Kong: O Novo Império
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Godzilla.x.Kong.O.Novo.Imperio.2024.1080p.WEB-DL.EAC3.AAC.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Godzilla.x.Kong.O.Novo.Imperio.2024.1080p.WEB-DL.EAC3.AAC.DUAL.5.1.mkv';
-- Harold e o Lápis Mágico
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Harold.e.o.Lapis.Magico.2024.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Harold.e.o.Lapis.Magico.2024.1080p.WEB-DL.DUAL.5.1.mkv';
-- Hellboy e o Homem Torto
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Hellboy.e.o.Homem.Torto.2024.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Hellboy.e.o.Homem.Torto.2024.1080p.WEB-DL.DUAL.5.1.mkv';
-- Homem-Aranha: Através do Aranhaverso
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Homem-Aranha.Atraves.do.Aranhaverso.2023.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Homem-Aranha.Atraves.do.Aranhaverso.2023.1080p.WEB-DL.DUAL.5.1.mkv';
-- Indiana Jones e A Relíquia do Destino
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Indiana.Jones.e.a.Reliquia.do.Destino.2023.1080p.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Indiana.Jones.e.a.Reliquia.do.Destino.2023.1080p.DUAL.5.1.mkv';
-- John Wick 4: Baba Yaga
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/John.Wick.4.-.Baba.Yaga.2023.1080p.BluRay.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/John.Wick.4.-.Baba.Yaga.2023.1080p.BluRay.DUAL.5.1.mkv';
-- Jojo Rabbit
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Jojo.Rabbit.2019.1080p.BluRay.x264-DUAL-COMANDO.TO.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Jojo.Rabbit.2019.1080p.BluRay.x264-DUAL-COMANDO.TO.mkv';
-- King's Man: A Origem
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/King_s.Man.A.Origem.2022.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/King_s.Man.A.Origem.2022.1080p.WEB-DL.DUAL.5.1.mkv';
-- Kraven: O Caçador
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Kraven.O.Cacador.2024.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Kraven.O.Cacador.2024.1080p.WEB-DL.DUAL.5.1.mkv';
-- Kung Fu Panda 4
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Kung.Fu.Panda.4.2024.1080p.WEB-DL.EAC3.AAC.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Kung.Fu.Panda.4.2024.1080p.WEB-DL.EAC3.AAC.DUAL.5.1.mkv';
-- Lightyear
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Lightyear.2022.WEB-DL.1080p.IMAX.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Lightyear.2022.WEB-DL.1080p.IMAX.DUAL.5.1.mkv';
-- Lilo & Stitch
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Lilo.and.Stitch.2025.1080p.FULL.HD.WEB-DL.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Lilo.and.Stitch.2025.1080p.FULL.HD.WEB-DL.DUAL.5.1.mkv';
-- Maldição da Múmia
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Maldicao.da.Mumia.2026.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Maldicao.da.Mumia.2026.1080p.WEB-DL.DUAL.5.1.mkv';
-- Missão: Impossível - O Acerto Final
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Missao.Impossivel.O.Acerto.Final.2025.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Missao.Impossivel.O.Acerto.Final.2025.1080p.WEB-DL.DUAL.5.1.mkv';
-- Moana 2
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Moana.2.2024.1080p.FULL.HD.WEB-DL.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Moana.2.2024.1080p.FULL.HD.WEB-DL.DUAL.5.1.mkv';
-- Moana: Um Mar de Aventuras
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Moana.Um.Mar.de.Aventuras.2017.1080p.BluRay.DD5.1.x264.DUAL-TDF.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Moana.Um.Mar.de.Aventuras.2017.1080p.BluRay.DD5.1.x264.DUAL-TDF.mkv';
-- Mufasa: O Rei Leão
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Mufasa.O..Rei.Leao.2024.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Mufasa.O..Rei.Leao.2024.1080p.WEB-DL.DUAL.5.1.mkv';
-- O Diabo Veste Prada
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/O.Diabo.Veste.Prada.2006.1080p.Bluray.x264.DUAL.2.0.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/O.Diabo.Veste.Prada.2006.1080p.Bluray.x264.DUAL.2.0.mkv';
-- O Drama
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/O.Drama.2026.WEB-DL.1080p.x264.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/O.Drama.2026.WEB-DL.1080p.x264.DUAL.5.1.mkv';
-- O Dublê
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/O.Duble.2024.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/O.Duble.2024.1080p.WEB-DL.DUAL.5.1.mkv';
-- O Gato
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/O.Gato.2003.1080p.AMZN.WEB-DL.DDP5.1.H264.Dual.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/O.Gato.2003.1080p.AMZN.WEB-DL.DDP5.1.H264.Dual.mkv';
-- O Hobbit: A Batalha dos Cinco Exércitos
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/O.Hobbit.A.Batalha.dos.Cinco.Exercitos.Versao.Estendida.2014.1080p.5.1.x264.DUAL-WWW.BLUDV.COM.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/O.Hobbit.A.Batalha.dos.Cinco.Exercitos.Versao.Estendida.2014.1080p.5.1.x264.DUAL-WWW.BLUDV.COM.mkv';
-- O Hobbit: A Desolação de Smaug
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/O.Hobbit.A.Desolacao.de.Smaug.2013.Versao.Estendida.1080p.BluRay.5.1.x264.DUAL-WWW.BLUDV.COM.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/O.Hobbit.A.Desolacao.de.Smaug.2013.Versao.Estendida.1080p.BluRay.5.1.x264.DUAL-WWW.BLUDV.COM.mkv';
-- O Hobbit: Uma Jornada Inesperada
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/O.Hobbit.Uma.Jornada.Inesperada.2012.Versao.Estendida.1080p.BluRay.5.1.x264.DUAL-WWW.BLUDV.COM.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/O.Hobbit.Uma.Jornada.Inesperada.2012.Versao.Estendida.1080p.BluRay.5.1.x264.DUAL-WWW.BLUDV.COM.mkv';
-- Os Fantasmas Ainda se Divertem: Beetlejuice Beetlejuice
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Os.Fantasmas.Ainda.se.Divertem.Beetlejuice.Beetlejuice.2024.1080p.WEB-DL.AC3.AAC.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Os.Fantasmas.Ainda.se.Divertem.Beetlejuice.Beetlejuice.2024.1080p.WEB-DL.AC3.AAC.DUAL.5.1.mkv';
-- Planeta dos Macacos: O Reinado
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Planeta.dos.Macacos.O.Reinado.2024.1080p.WEB-DL.EAC3.AAC.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Planeta.dos.Macacos.O.Reinado.2024.1080p.WEB-DL.EAC3.AAC.DUAL.5.1.mkv';
-- Pânico 7
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Panico.7.2026.1080p.WEB-DL.x264.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Panico.7.2026.1080p.WEB-DL.x264.DUAL.5.1.mkv';
-- Pânico VI
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Panico.VI.2023.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Panico.VI.2023.1080p.WEB-DL.DUAL.5.1.mkv';
-- Resistência
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Resistencia.2023.1080p.BluRay.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Resistencia.2023.1080p.BluRay.DUAL.5.1.mkv';
-- Robin Hood: A Origem
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Robin.Hood.A.Origem.2019.1080p.BluRay.6CH.x264.DUAL-WWW.BLUDV.TV.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Robin.Hood.A.Origem.2019.1080p.BluRay.6CH.x264.DUAL-WWW.BLUDV.TV.mkv';
-- Sonic 3: O Filme
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Sonic.3.O.Filme.2024.1080p.FULL.HD.WEB-DL.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Sonic.3.O.Filme.2024.1080p.FULL.HD.WEB-DL.DUAL.5.1.mkv';
-- Super Mario Galaxy: O Filme
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Super.Mario.Galaxy-O.Filme.2026.WEB-DL.1080p.x264.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Super.Mario.Galaxy-O.Filme.2026.WEB-DL.1080p.x264.DUAL.5.1.mkv';
-- Teen Wolf: O Filme
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Teen.Wolf.-.O.Filme.2023.1080p.WEB-DL.DUAL.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Teen.Wolf.-.O.Filme.2023.1080p.WEB-DL.DUAL.mkv';
-- The Flash
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/The.Flash.2023.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/The.Flash.2023.1080p.WEB-DL.DUAL.5.1.mkv';
-- Tomb Raider: A Origem
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Tomb.Raider.A.Origem.2018.1080p.BluRay.6CH.x264.DUAL-WWW.BLUDV.COM.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Tomb.Raider.A.Origem.2018.1080p.BluRay.6CH.x264.DUAL-WWW.BLUDV.COM.mkv';
-- Transformers: O Despertar das Feras
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Transformers.-.O.Despertar.das.Feras.2023.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Transformers.-.O.Despertar.das.Feras.2023.1080p.WEB-DL.DUAL.5.1.mkv';
-- Um Filme Minecraft
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Um.Filme.Minecraft.2025.1080p.WEB-DL.EAC3.AAC.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Um.Filme.Minecraft.2025.1080p.WEB-DL.EAC3.AAC.DUAL.5.1.mkv';
-- Venom: A Última Rodada
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Venom.A.Ultima.Rodada.2024.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Venom.A.Ultima.Rodada.2024.1080p.WEB-DL.DUAL.5.1.mkv';
-- Wicked
UPDATE movies SET file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Wicked.2024.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_subtitled = 'https://cineflix-cdn.victorlima0978.workers.dev/Wicked.2024.1080p.WEB-DL.DUAL.5.1.mkv';
-- Wish: O Poder dos Desejos
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Wish.-.O.Poder.dos.Desejos.2023.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Wish.-.O.Poder.dos.Desejos.2023.1080p.WEB-DL.DUAL.5.1.mkv';
-- Wonka
UPDATE movies SET file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Wonka.2023.1080p.WEB-DL.DUAL.5.1.mp4' WHERE file_dubbing = 'https://cineflix-cdn.victorlima0978.workers.dev/Wonka.2023.1080p.WEB-DL.DUAL.5.1.mkv';
COMMIT;
