const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const profileId = req.query.profile_id || req.headers['x-profile-id'] || null;

    let query = supabase
      .from('watch_history')
      .select('*')
      .eq('user_id', req.user.id)
      .order('last_watched', { ascending: false })
      .limit(50);

    if (profileId) query = query.eq('profile_id', profileId);

    const { data: items, error } = await query;

    if (error) throw error;
    if (!items || items.length === 0) return res.json([]);

    const movieIds = items.filter(i => i.content_type === 'movie').map(i => i.content_id);
    const episodeIds = items.filter(i => i.content_type === 'episode').map(i => i.content_id);

    const [moviesRes, episodesRes] = await Promise.all([
      movieIds.length > 0
        ? supabase.from('movies').select('id, title, poster_url, year').in('id', movieIds)
        : { data: [] },
      episodeIds.length > 0
        ? supabase.from('episodes').select('id, title, thumbnail_url, season_number, episode_number, series_id').in('id', episodeIds)
        : { data: [] },
    ]);

    const moviesMap = Object.fromEntries((moviesRes.data || []).map(m => [m.id, m]));
    const episodesMap = Object.fromEntries((episodesRes.data || []).map(e => [e.id, e]));

    // Fetch series info for episodes
    const seriesIds = [...new Set(
      (episodesRes.data || []).map(e => e.series_id).filter(Boolean)
    )];
    let seriesMap = {};
    if (seriesIds.length > 0) {
      const { data: seriesData } = await supabase
        .from('series')
        .select('id, title, poster_url')
        .in('id', seriesIds);
      seriesMap = Object.fromEntries((seriesData || []).map(s => [s.id, s]));
    }

    const enriched = items.map(item => {
      if (item.content_type === 'movie') {
        const meta = moviesMap[item.content_id] || {};
        return { ...item, title: meta.title, poster_url: meta.poster_url };
      }
      const ep = episodesMap[item.content_id] || {};
      const serie = seriesMap[ep.series_id] || {};
      return {
        ...item,
        title: serie.title,
        poster_url: serie.poster_url,
        episode_title: ep.title,
        season_number: ep.season_number,
        episode_number: ep.episode_number,
        series_id: ep.series_id || item.series_id,
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { content_type, content_id, episode_id, series_id, progress, duration, profile_id } = req.body;
  if (!content_type || !content_id) {
    return res.status(400).json({ error: 'content_type e content_id são obrigatórios' });
  }

  try {
    const completed = duration > 0 ? progress / duration >= 0.9 : false;

    let findQ = supabase
      .from('watch_history')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('content_id', content_id)
      .eq('episode_id', episode_id || null);
    if (profile_id) findQ = findQ.eq('profile_id', profile_id);

    const { data: existing } = await findQ.single();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('watch_history')
        .update({ progress, duration, completed, last_watched: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('watch_history')
        .insert({ user_id: req.user.id, content_type, content_id, episode_id, series_id, progress, duration, completed, profile_id: profile_id || null })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
