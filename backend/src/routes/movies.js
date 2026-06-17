const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { optionalAuth } = require('../middleware/auth');

const PUBLIC_FIELDS = 'id, tmdb_id, title, original_title, synopsis, year, duration, rating, genres, poster_url, backdrop_url, trailer_url, age_rating, file_dubbing, file_subtitled, file_cinema, file_4k, subtitle_pt, subtitle_en, subtitle_es, is_featured, views';

// Lista filmes com filtros e paginação
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { genre, year, sort = 'created_at', order = 'desc', page = 1, limit = 24 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('movies')
      .select(PUBLIC_FIELDS, { count: 'exact' })
      .eq('is_active', true)
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + Number(limit) - 1);

    if (genre) query = query.contains('genres', [genre]);
    if (year) query = query.eq('year', Number(year));

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
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
