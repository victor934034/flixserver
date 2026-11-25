const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/admin');
const skipTimes = require('../services/skipTimes');

const UUID = /^[0-9a-f-]{36}$/i;

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

// Abertura e créditos (segundos). Exige login pra ninguém de fora disparar buscas.
// Nunca devolve erro pro player: sem dado, ele só não mostra os botões.
router.get('/:id/skip-times', authMiddleware, async (req, res) => {
  const none = { intro_start: null, intro_end: null, credits_start: null, source: null };
  if (!UUID.test(req.params.id)) return res.json(none);
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await skipTimes.getSkipTimes(supabase, req.params.id));
  } catch (e) {
    console.error('[abertura] erro:', e.message);
    res.json(none);
  }
});

// Admin: corrige os tempos de um episódio
router.put('/:id/skip-times', adminMiddleware, async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Episódio inválido' });
  try {
    res.json(await skipTimes.saveManual(supabase, req.params.id, req.body || {}));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Admin: apaga a correção e volta pra busca automática
router.delete('/:id/skip-times', adminMiddleware, async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Episódio inválido' });
  try {
    await skipTimes.clearStored(supabase, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
