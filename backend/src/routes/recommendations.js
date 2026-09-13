const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Peso por posição no histórico (mais recente = maior peso) — decaimento
// exponencial simples, sem precisar de coluna nova nem tabela nova.
const DECAY = 0.85;

// GET /api/recommendations?profile_id=X&limit=20
// Recomendação baseada em conteúdo: perfil de afinidade por gênero calculado
// a partir do watch_history (mesma tabela do "Continuar Assistindo"), sem
// collaborative filtering — feito pra uso pessoal/poucos perfis.
router.get('/', async (req, res) => {
  try {
    const profileId = req.query.profile_id || req.headers['x-profile-id'] || null;
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    let histQ = supabase
      .from('watch_history')
      .select('content_type, content_id, series_id, last_watched')
      .eq('user_id', req.user.id)
      .order('last_watched', { ascending: false })
      .limit(30);
    histQ = profileId ? histQ.eq('profile_id', profileId) : histQ.is('profile_id', null);
    const { data: history, error: histErr } = await histQ;
    if (histErr) throw histErr;

    const watchedMovieIds = [...new Set(history.filter(h => h.content_type === 'movie').map(h => h.content_id))];
    const watchedSeriesIds = [...new Set(
      history.filter(h => h.content_type === 'episode' && h.series_id).map(h => h.series_id)
    )];

    // Se nunca assistiu nada ainda, não tem base pra recomendar — deixa o
    // catálogo de "populares" cobrir esse caso no front.
    if (watchedMovieIds.length === 0 && watchedSeriesIds.length === 0) {
      return res.json([]);
    }

    const [watchedMoviesRes, watchedSeriesRes] = await Promise.all([
      watchedMovieIds.length > 0
        ? supabase.from('movies').select('id, genres').in('id', watchedMovieIds)
        : { data: [] },
      watchedSeriesIds.length > 0
        ? supabase.from('series').select('id, genres').in('id', watchedSeriesIds)
        : { data: [] },
    ]);
    const movieGenresMap = Object.fromEntries((watchedMoviesRes.data || []).map(m => [m.id, m.genres || []]));
    const seriesGenresMap = Object.fromEntries((watchedSeriesRes.data || []).map(s => [s.id, s.genres || []]));

    // Score de afinidade por gênero: soma dos pesos (por recência) de cada
    // vez que o gênero apareceu no histórico.
    const affinity = {};
    history.forEach((h, idx) => {
      const weight = Math.pow(DECAY, idx);
      const genres = h.content_type === 'movie'
        ? (movieGenresMap[h.content_id] || [])
        : (seriesGenresMap[h.series_id] || []);
      genres.forEach(g => { affinity[g] = (affinity[g] || 0) + weight; });
    });

    if (Object.keys(affinity).length === 0) return res.json([]);

    const [allMoviesRes, allSeriesRes] = await Promise.all([
      supabase.from('movies')
        .select('id, title, synopsis, year, rating, genres, poster_url, backdrop_url, age_rating, file_dubbing, file_subtitled, file_cinema, file_4k')
        .limit(500),
      supabase.from('series')
        .select('id, title, synopsis, year_start, rating, genres, poster_url, backdrop_url, age_rating, total_seasons')
        .limit(500),
    ]);

    const watchedMovieSet = new Set(watchedMovieIds);
    const watchedSeriesSet = new Set(watchedSeriesIds);

    function scoreOf(genres) {
      return (genres || []).reduce((sum, g) => sum + (affinity[g] || 0), 0);
    }

    const scoredMovies = (allMoviesRes.data || [])
      .filter(m => !watchedMovieSet.has(m.id))
      .map(m => ({ ...m, content_type: 'movie', _score: scoreOf(m.genres) }))
      .filter(m => m._score > 0);

    const scoredSeries = (allSeriesRes.data || [])
      .filter(s => !watchedSeriesSet.has(s.id))
      .map(s => ({ ...s, content_type: 'series', _score: scoreOf(s.genres) }))
      .filter(s => s._score > 0);

    const results = [...scoredMovies, ...scoredSeries]
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, ...item }) => item);

    res.json(results);
  } catch (err) {
    console.error('[recommendations] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
