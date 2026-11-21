const router = require('express').Router();
const { supabase, fetchAll } = require('../services/supabase');
const { optionalAuth } = require('../middleware/auth');
const { searchIds, orderByIds } = require('../services/titleSearch');

const PUBLIC_FIELDS = 'id, tmdb_id, title, original_title, synopsis, year_start, year_end, total_seasons, rating, genres, poster_url, backdrop_url, trailer_url, age_rating, status, is_featured, views, release_date';

// Series nao tem versao de audio/cor na propria linha (isso vive por episodio),
// entao pra badge P&B nos cards fazemos 1 query extra: quais series da lista
// tem pelo menos 1 episodio com file_bw preenchido.
async function attachHasBw(list) {
  if (!list || !list.length) return list;
  const ids = list.map(s => s.id);
  const { data: bwEps } = await supabase
    .from('episodes')
    .select('series_id')
    .in('series_id', ids)
    .not('file_bw', 'is', null);
  const bwSet = new Set((bwEps || []).map(e => e.series_id));
  return list.map(s => ({ ...s, has_bw: bwSet.has(s.id) }));
}

router.get('/', optionalAuth, async (req, res) => {
  try {
    const { genre, year_from, year_to, released_days, min_rating, order = 'desc', page = 1, limit = 24 } = req.query;
    const sort = ['created_at', 'release_date', 'year_start', 'rating', 'views', 'title'].includes(req.query.sort) ? req.query.sort : 'created_at';
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('series')
      .select(PUBLIC_FIELDS, { count: 'exact' })
      .eq('is_active', true)
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + Number(limit) - 1);

    if (genre) { const gl = String(genre).split(',').map(x => x.trim()).filter(Boolean); query = gl.length > 1 ? query.overlaps('genres', gl) : query.contains('genres', gl); }
    if (year_from) query = query.gte('year_start', Number(year_from));
    if (year_to) query = query.lte('year_start', Number(year_to));
    if (min_rating) query = query.gte('rating', Number(min_rating));
    if (released_days) {
      const from = new Date(Date.now() - Number(released_days) * 86400000).toISOString().slice(0, 10);
      query = query.gte('release_date', from).lte('release_date', new Date().toISOString().slice(0, 10));
    }

    let { data, error, count } = await query;
    if (error) throw error;
    data = await attachHasBw(data);

    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Busca por título
router.get('/search', async (req, res) => {
  const { q = '' } = req.query;
  if (!q.trim()) return res.json([]);
  try {
    const ids = await searchIds('series', q, 20);
    if (!ids.length) return res.json([]);
    const { data, error } = await supabase
      .from('series')
      .select(PUBLIC_FIELDS)
      .eq('is_active', true)
      .in('id', ids);
    if (error) throw error;
    res.json(await attachHasBw(orderByIds(data || [], ids)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('series')
      .select(PUBLIC_FIELDS)
      .eq('id', req.params.id)
      .eq('is_active', true)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Série não encontrada' });

    supabase.rpc('increment_views', { table_name: 'series', record_id: req.params.id }).then(() => {});

    const [withBw] = await attachHasBw([data]);
    res.json(withBw);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/episodes', async (req, res) => {
  try {
    const { season } = req.query;
    const { data, error } = await fetchAll(() => {
      let query = supabase
        .from('episodes')
        .select('id, season_number, episode_number, title, synopsis, duration, thumbnail_url, file_dubbing, file_subtitled, file_cinema, file_color, file_bw, subtitle_pt, subtitle_en, subtitle_es, air_date, views')
        .eq('series_id', req.params.id)
        .eq('is_active', true)
        .order('season_number')
        .order('episode_number');
      if (season) query = query.eq('season_number', Number(season));
      return query;
    });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/section/new', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('series')
      .select(PUBLIC_FIELDS)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json(await attachHasBw(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/section/released', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('series')
      .select(PUBLIC_FIELDS)
      .eq('is_active', true)
      .not('release_date', 'is', null)
      .lte('release_date', today)
      .order('release_date', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json(await attachHasBw(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/section/popular', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('series')
      .select(PUBLIC_FIELDS)
      .eq('is_active', true)
      .order('views', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json(await attachHasBw(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Nomes e imagens das temporadas vindos do TMDB (ex.: One Piece mostra
// "Saga East Blue", "Arco Alabasta"... em vez de "Temporada 1, 2...").
// Cache em memória de 12h por série.
const seasonsCache = new Map();
router.get('/:id/seasons', async (req, res) => {
  try {
    const hit = seasonsCache.get(req.params.id);
    if (hit && Date.now() - hit.at < 12 * 3600 * 1000) return res.json(hit.data);

    const { data: serie } = await supabase.from('series').select('tmdb_id').eq('id', req.params.id).single();
    if (!serie?.tmdb_id) return res.json([]);

    const axios = require('axios');
    const { data } = await axios.get(`https://api.themoviedb.org/3/tv/${serie.tmdb_id}`, {
      params: { api_key: process.env.TMDB_API_KEY, language: 'pt-BR' }, timeout: 10_000,
    });
    const list = (data.seasons || []).map(s => ({
      season_number: s.season_number,
      name: s.name || (s.season_number === 0 ? 'Especiais' : `Temporada ${s.season_number}`),
      episode_count: s.episode_count,
      overview: s.overview || '',
      air_date: s.air_date,
      poster_url: s.poster_path ? `https://image.tmdb.org/t/p/w300${s.poster_path}` : null,
    }));
    seasonsCache.set(req.params.id, { at: Date.now(), data: list });
    res.json(list);
  } catch (err) {
    res.json([]); // sem nomes, o app cai no "Temporada N"
  }
});

module.exports = router;
