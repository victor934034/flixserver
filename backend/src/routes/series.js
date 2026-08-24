const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { optionalAuth } = require('../middleware/auth');

const PUBLIC_FIELDS = 'id, tmdb_id, title, original_title, synopsis, year_start, year_end, total_seasons, rating, genres, poster_url, backdrop_url, trailer_url, age_rating, status, is_featured, views';

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
    const { genre, sort = 'created_at', order = 'desc', page = 1, limit = 24 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('series')
      .select(PUBLIC_FIELDS, { count: 'exact' })
      .eq('is_active', true)
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + Number(limit) - 1);

    if (genre) query = query.contains('genres', [genre]);

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
    const { data, error } = await supabase
      .from('series')
      .select(PUBLIC_FIELDS)
      .eq('is_active', true)
      .ilike('title', `%${q}%`)
      .limit(20);
    if (error) throw error;
    res.json(await attachHasBw(data || []));
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
    let query = supabase
      .from('episodes')
      .select('id, season_number, episode_number, title, synopsis, duration, thumbnail_url, file_dubbing, file_subtitled, file_cinema, file_color, file_bw, subtitle_pt, subtitle_en, subtitle_es, air_date, views')
      .eq('series_id', req.params.id)
      .eq('is_active', true)
      .order('season_number')
      .order('episode_number');

    if (season) query = query.eq('season_number', Number(season));

    const { data, error } = await query;
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

module.exports = router;
