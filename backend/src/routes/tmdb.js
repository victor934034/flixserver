const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { searchTMDB, getDetails, buildMovieData, buildSeriesData, extractAgeRating } = require('../services/tmdb');
const { adminMiddleware } = require('../middleware/admin');
const { sendPushToAll } = require('../services/notifications');

router.use(adminMiddleware);

// Detecta e importa pelo nome do arquivo
router.post('/detect', async (req, res) => {
  const { fileUrl, version = 'dubbing' } = req.body;
  if (!fileUrl) return res.status(400).json({ error: 'fileUrl é obrigatório' });

  try {
    const { processFiles } = require('../../tmdb-bot');
    const report = await processFiles([{ url: fileUrl, version }]);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Importa por ID TMDB
router.post('/import/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  const { type = 'movie', fileUrl, version = 'dubbing' } = req.body;

  try {
    const details = await getDetails(Number(tmdbId), type);
    if (!details) return res.status(404).json({ error: 'ID TMDB não encontrado' });

    if (type === 'movie') {
      const movieData = buildMovieData(details);
      if (fileUrl) movieData[`file_${version}`] = fileUrl;

      const { data, error } = await supabase
        .from('movies')
        .upsert(movieData, { onConflict: 'tmdb_id' })
        .select()
        .single();

      if (error) throw error;
      if (data.is_active && data.title) {
        sendPushToAll(supabase, `🎬 ${data.title}`, 'Novo filme adicionado!', { screen: 'filme', id: data.id }).catch(() => {});
      }
      return res.json({ type: 'movie', data });
    }

    const seriesData = buildSeriesData(details);
    const { data, error } = await supabase
      .from('series')
      .upsert(seriesData, { onConflict: 'tmdb_id' })
      .select()
      .single();

    if (error) throw error;
    if (data.is_active && data.title) {
      sendPushToAll(supabase, `📺 ${data.title}`, 'Nova série adicionada!', { screen: 'serie', id: data.id }).catch(() => {});
    }
    res.json({ type: 'series', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Busca detalhes por ID TMDB sem salvar (para o admin pré-visualizar)
router.get('/details/:id', async (req, res) => {
  const { type = 'movie' } = req.query;
  try {
    const details = await getDetails(Number(req.params.id), type);
    if (!details) return res.status(404).json({ error: 'Não encontrado' });
    details.age_rating = extractAgeRating(details, type);
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Busca no TMDB sem salvar (para o admin pré-visualizar) — retorna 1 resultado completo
router.get('/search', async (req, res) => {
  const { q, type = 'movie', year } = req.query;
  if (!q) return res.status(400).json({ error: 'q é obrigatório' });

  try {
    const result = await searchTMDB(q, type, year || null);
    if (!result) return res.json(null);

    const details = await getDetails(result.id, type);
    // Adiciona age_rating extraído para uso no admin
    details.age_rating = extractAgeRating(details, type);
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Busca múltipla no TMDB — retorna lista de resultados para o usuário escolher
router.get('/search-multiple', async (req, res) => {
  const { q, type = 'movie', year } = req.query;
  if (!q) return res.status(400).json({ error: 'q é obrigatório' });

  const axios = require('axios');
  const TMDB_BASE = 'https://api.themoviedb.org/3';
  const TMDB_IMG = 'https://image.tmdb.org/t/p/w300';

  try {
    const endpoint = type === 'movie' ? 'search/movie' : 'search/tv';
    const params = { api_key: process.env.TMDB_API_KEY, query: q, language: 'pt-BR' };
    if (year) params.year = year;

    const { data } = await axios.get(`${TMDB_BASE}/${endpoint}`, { params });
    let results = data.results || [];

    if (results.length === 0) {
      params.language = 'en-US';
      const retry = await axios.get(`${TMDB_BASE}/${endpoint}`, { params });
      results = retry.data.results || [];
    }

    const mapped = results.slice(0, 8).map(r => ({
      id: r.id,
      title: r.title || r.name,
      original_title: r.original_title || r.original_name,
      year: (r.release_date || r.first_air_date || '').split('-')[0] || null,
      poster_url: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
      rating: r.vote_average ? parseFloat(r.vote_average.toFixed(1)) : null,
      overview: r.overview,
    }));

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista temporadas de uma série (para upload de desenhos)
router.get('/tv-seasons/:tmdbId', async (req, res) => {
  const axios = require('axios');
  const TMDB_BASE = 'https://api.themoviedb.org/3';
  const TMDB_IMG = 'https://image.tmdb.org/t/p/w300';
  try {
    const { data } = await axios.get(`${TMDB_BASE}/tv/${req.params.tmdbId}`, {
      params: { api_key: process.env.TMDB_API_KEY, language: 'pt-BR' },
    });
    const seasons = (data.seasons || [])
      .filter(s => s.season_number > 0)
      .map(s => ({
        season_number: s.season_number,
        name: s.name,
        episode_count: s.episode_count,
        air_date: s.air_date,
        poster_url: s.poster_path ? `${TMDB_IMG}${s.poster_path}` : null,
      }));
    res.json({ tmdb_id: data.id, title: data.name, seasons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista episódios de uma temporada específica (para upload de desenhos)
router.get('/tv-season/:tmdbId/:seasonNum', async (req, res) => {
  const axios = require('axios');
  const TMDB_BASE = 'https://api.themoviedb.org/3';
  const TMDB_IMG = 'https://image.tmdb.org/t/p/w300';
  try {
    const { data } = await axios.get(
      `${TMDB_BASE}/tv/${req.params.tmdbId}/season/${req.params.seasonNum}`,
      { params: { api_key: process.env.TMDB_API_KEY, language: 'pt-BR' } },
    );
    const episodes = (data.episodes || []).map(ep => ({
      episode_number: ep.episode_number,
      title: ep.name,
      description: ep.overview,
      thumbnail_url: ep.still_path ? `${TMDB_IMG}${ep.still_path}` : null,
      air_date: ep.air_date,
      runtime: ep.runtime,
    }));
    res.json({ season_number: data.season_number, name: data.name, episodes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Importação em lote via Bot TMDB
router.post('/batch', async (req, res) => {
  const { files } = req.body; // [{ url, version }]
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'files deve ser um array não-vazio' });
  }

  try {
    const { processFiles } = require('../../tmdb-bot');
    const report = await processFiles(files);

    // Notifica sobre conteúdo adicionado
    const added = (report || []).filter(r => r.status === 'ok' || r.status === 'created');
    const movies = added.filter(r => r.type === 'movie');
    const seriesList = added.filter(r => r.type === 'series');
    const episodes = added.filter(r => r.type === 'episode');

    if (movies.length === 1) {
      sendPushToAll(supabase, `🎬 ${movies[0].title}`, 'Novo filme adicionado!', { screen: 'filme', id: movies[0].id }).catch(() => {});
    } else if (movies.length > 1) {
      sendPushToAll(supabase, '🎬 Novos filmes adicionados!', `${movies.length} filmes foram adicionados`).catch(() => {});
    }

    if (seriesList.length === 1) {
      sendPushToAll(supabase, `📺 ${seriesList[0].title}`, 'Nova série adicionada!', { screen: 'serie', id: seriesList[0].id }).catch(() => {});
    } else if (seriesList.length > 1) {
      sendPushToAll(supabase, '📺 Novas séries adicionadas!', `${seriesList.length} séries foram adicionadas`).catch(() => {});
    }

    // Episódios: agrupa por série
    if (episodes.length > 0) {
      const bySeries = {};
      for (const ep of episodes) {
        const key = ep.seriesId || ep.series_id || 'unknown';
        if (!bySeries[key]) bySeries[key] = { title: ep.seriesTitle || 'Série', eps: [] };
        bySeries[key].eps.push(ep);
      }
      for (const { title, eps } of Object.values(bySeries)) {
        const body = eps.length === 1
          ? `${eps[0].episodeLabel || 'Novo episódio'} • Novo ep disponível`
          : `${eps.length} episódios foram adicionados`;
        sendPushToAll(supabase, `📺 ${title}`, body).catch(() => {});
      }
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
