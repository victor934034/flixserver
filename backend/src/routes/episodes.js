const router = require('express').Router();
const { supabase } = require('../services/supabase');

// GET /api/episodes/section/recent — episódios adicionados recentemente (qualquer série)
// Precisa vir ANTES de /:id, senão "recent" seria interpretado como um id.
router.get('/section/recent', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const { data, error } = await supabase
      .from('episodes')
      .select('id, title, thumbnail_url, season_number, episode_number, series_id, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    const seriesIds = [...new Set((data || []).map(e => e.series_id).filter(Boolean))];
    const { data: seriesData } = seriesIds.length
      ? await supabase.from('series').select('id, title, poster_url, age_rating').in('id', seriesIds).eq('is_active', true)
      : { data: [] };
    const seriesMap = Object.fromEntries((seriesData || []).map(s => [s.id, s]));

    const enriched = (data || [])
      .filter(e => seriesMap[e.series_id])
      .map(e => ({
        id: e.id,
        title: e.title,
        season_number: e.season_number,
        episode_number: e.episode_number,
        series_id: e.series_id,
        series_title: seriesMap[e.series_id].title,
        poster_url: e.thumbnail_url || seriesMap[e.series_id].poster_url,
        age_rating: seriesMap[e.series_id].age_rating,
      }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('episodes')
      .select('*')
      .eq('id', req.params.id)
      .eq('is_active', true)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Episódio não encontrado' });

    supabase
      .from('episodes')
      .update({ views: (data.views || 0) + 1 })
      .eq('id', req.params.id)
      .then(() => {});

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
