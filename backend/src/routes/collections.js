const router = require('express').Router();
const { supabase } = require('../services/supabase');

// GET /api/collections — lista coleções/cronologias ativas
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('collections')
      .select('id, name, slug, description, cover_url, order_index')
      .eq('is_active', true)
      .order('order_index');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/collections/:slug — detalhe da coleção com itens em ordem
router.get('/:slug', async (req, res) => {
  try {
    const { data: collection, error } = await supabase
      .from('collections')
      .select('*')
      .eq('slug', req.params.slug)
      .eq('is_active', true)
      .single();
    if (error || !collection) return res.status(404).json({ error: 'Coleção não encontrada' });

    const { data: items, error: itemsError } = await supabase
      .from('collection_items')
      .select('*')
      .eq('collection_id', collection.id)
      .order('position');
    if (itemsError) throw itemsError;

    const movieIds = (items || []).filter(i => i.content_type === 'movie').map(i => i.content_id);
    const seriesIds = (items || []).filter(i => i.content_type === 'series').map(i => i.content_id);

    const [moviesRes, seriesRes] = await Promise.all([
      movieIds.length
        ? supabase.from('movies').select('id, title, poster_url, backdrop_url, synopsis, year, rating, genres').in('id', movieIds).eq('is_active', true)
        : { data: [] },
      seriesIds.length
        ? supabase.from('series').select('id, title, poster_url, backdrop_url, synopsis, year_start, rating, genres').in('id', seriesIds).eq('is_active', true)
        : { data: [] },
    ]);

    const moviesMap = Object.fromEntries((moviesRes.data || []).map(m => [m.id, m]));
    const seriesMap = Object.fromEntries((seriesRes.data || []).map(s => [s.id, s]));

    const enrichedItems = (items || [])
      .map(item => {
        const meta = item.content_type === 'movie' ? moviesMap[item.content_id] : seriesMap[item.content_id];
        if (!meta) return null;
        return { ...meta, type: item.content_type, position: item.position, note: item.note };
      })
      .filter(Boolean);

    res.json({ ...collection, items: enrichedItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
