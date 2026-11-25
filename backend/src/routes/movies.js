const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { optionalAuth } = require('../middleware/auth');
const { searchIds, orderByIds } = require('../services/titleSearch');

const PUBLIC_FIELDS = 'id, tmdb_id, title, original_title, synopsis, year, duration, rating, genres, poster_url, backdrop_url, trailer_url, age_rating, file_dubbing, file_subtitled, file_cinema, file_4k, file_color, file_bw, subtitle_pt, subtitle_en, subtitle_es, is_featured, views, release_date';

const SORTABLE = ['created_at', 'release_date', 'year', 'rating', 'views', 'title'];

// Lista filmes com filtros e paginação
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { genre, year, year_from, year_to, released_days, min_rating, order = 'desc', page = 1, limit = 24 } = req.query;
    const sort = SORTABLE.includes(req.query.sort) ? req.query.sort : 'created_at';
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('movies')
      .select(PUBLIC_FIELDS, { count: 'exact' })
      .eq('is_active', true)
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + Number(limit) - 1);

    if (genre) { const gl = String(genre).split(',').map(x => x.trim()).filter(Boolean); query = gl.length > 1 ? query.overlaps('genres', gl) : query.contains('genres', gl); }
    if (year) query = query.eq('year', Number(year));
    if (year_from) query = query.gte('year', Number(year_from));
    if (year_to) query = query.lte('year', Number(year_to));
    if (min_rating) query = query.gte('rating', Number(min_rating));
    if (released_days) {
      const from = new Date(Date.now() - Number(released_days) * 86400000).toISOString().slice(0, 10);
      query = query.gte('release_date', from).lte('release_date', new Date().toISOString().slice(0, 10));
    }

    const { data, error, count } = await query;
    if (error) throw error;

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
    const ids = await searchIds('movies', q, 20);
    if (!ids.length) return res.json([]);
    const { data, error } = await supabase
      .from('movies')
      .select(PUBLIC_FIELDS)
      .eq('is_active', true)
      .in('id', ids);
    if (error) throw error;
    res.json(orderByIds(data || [], ids));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// "Surpreenda-me": sorteia um filme, com filtro de gênero opcional.
// exclude = ids já sorteados nesta rodada, pra "Sortear outro" não repetir.
router.get('/surprise', async (req, res) => {
  try {
    const genre = String(req.query.genre || '').trim();
    const exclude = String(req.query.exclude || '').split(',')
      .filter(id => /^[0-9a-f-]{36}$/i.test(id)).slice(-50);

    const build = (columns, options) => {
      let q = supabase.from('movies').select(columns, options).eq('is_active', true)
        .or('file_dubbing.not.is.null,file_subtitled.not.is.null,file_cinema.not.is.null,file_4k.not.is.null,file_color.not.is.null,file_bw.not.is.null');
      if (genre) q = q.contains('genres', [genre]);
      if (exclude.length) q = q.not('id', 'in', `(${exclude.join(',')})`);
      return q;
    };

    const { count, error: countError } = await build('id', { count: 'exact', head: true });
    if (countError) throw countError;
    if (!count) return res.status(404).json({ error: 'Nenhum filme encontrado' });

    const offset = Math.floor(Math.random() * count);
    const { data, error } = await build(PUBLIC_FIELDS).order('id').range(offset, offset);
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ error: 'Nenhum filme encontrado' });
    res.set('Cache-Control', 'no-store');
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detalhes de um filme
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('movies')
      .select(PUBLIC_FIELDS)
      .eq('id', req.params.id)
      .eq('is_active', true)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Filme não encontrado' });

    // Incrementa views de forma assíncrona
    supabase.rpc('increment_views', { table_name: 'movies', record_id: req.params.id }).then(() => {});

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Filmes recentes
router.get('/section/new', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('movies')
      .select(PUBLIC_FIELDS)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recém lançados: pela data REAL de lançamento (não pela data em que foi adicionado)
router.get('/section/released', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('movies')
      .select(PUBLIC_FIELDS)
      .eq('is_active', true)
      .not('release_date', 'is', null)
      .lte('release_date', today)
      .order('release_date', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mais assistidos
router.get('/section/popular', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('movies')
      .select(PUBLIC_FIELDS)
      .eq('is_active', true)
      .order('views', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
