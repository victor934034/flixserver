const router = require('express').Router();
const { supabase, fetchAll } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Peso por posição no histórico (mais recente = maior peso) — decaimento
// exponencial simples, sem precisar de coluna nova nem tabela nova.
const DECAY = 0.85;

// Cache em memória por usuário+perfil — evita bater no TMDB de novo toda
// vez que a Home abre (isso deixou o app "travando" às vezes: o TMDB é uma
// API externa e pode demorar ou falhar, e isso rodava a cada load da Home).
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — a chave inclui a assinatura do histórico, então muda sozinha quando o usuário assiste algo novo
const cache = new Map(); // key -> { data, expires }

function getCached(key) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  cache.delete(key);
  return null;
}
function setCached(key, data) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

// Nunca deixa uma chamada externa lenta seguro o request inteiro — corta
// depois de TMDB_OVERALL_TIMEOUT_MS e segue só com o que já respondeu.
const TMDB_OVERALL_TIMEOUT_MS = 2500;
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Quantos títulos recentes usamos como "semente" pra buscar parecidos no TMDB
// (sinopse+elenco+palavras-chave — não só gênero). Mais que isso não compensa
// o custo de rede por pouco ganho de sinal.
const TMDB_SEED_COUNT = 6;
// Multiplica o peso do sinal de "parecido no TMDB" em relação à afinidade
// de gênero pura — é um sinal mais específico (sinopse real, não só rótulo).
const TMDB_BOOST = 4;

// Busca títulos "parecidos" no TMDB pra um filme/série já assistido.
// TMDB já combina sinopse, elenco, palavras-chave e gênero no cálculo —
// muito mais rico do que comparar só a lista de gêneros.
// Cache longo dos "parecidos" do TMDB. Antes, se o TMDB demorasse mais que o
// timeout numa chamada, aquela semente sumia do cálculo e a lista inteira
// mudava sozinha (era o "recomendados para você" trocando sem eu assistir nada).
const SIMILAR_TTL_MS = 24 * 60 * 60 * 1000;
const similarCache = new Map(); // "type:id" -> { at, ids }
async function getSimilar(tmdbId, type, timeoutMs) {
  const key = `${type}:${tmdbId}`;
  const hit = similarCache.get(key);
  if (hit && Date.now() - hit.at < SIMILAR_TTL_MS) return hit.ids;
  const p = fetchTmdbSimilar(tmdbId, type).then(ids => {
    if (ids.length) similarCache.set(key, { at: Date.now(), ids });
    return ids;
  });
  // Estourou o tempo? usa o último valor conhecido (mesmo velho) e deixa a
  // requisição terminar em segundo plano pra preencher o cache.
  return withTimeout(p, timeoutMs, hit ? hit.ids : []);
}

async function fetchTmdbSimilar(tmdbId, type) {
  const axios = require('axios');
  const endpoint = type === 'movie' ? 'movie' : 'tv';
  try {
    const { data } = await axios.get(
      `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/recommendations`,
      { params: { api_key: process.env.TMDB_API_KEY, language: 'pt-BR' }, timeout: 5000 }
    );
    return (data.results || []).map(r => r.id);
  } catch {
    return [];
  }
}

// GET /api/recommendations/top10
// Os mais assistidos dos últimos 7 dias, contando CONTAS diferentes (a mesma
// pessoa vendo vários episódios conta uma vez). Filmes e séries juntos.
const TOP_TTL_MS = 30 * 60 * 1000;
let topCache = { at: 0, data: null };

router.get('/top10', async (req, res) => {
  try {
    if (topCache.data && Date.now() - topCache.at < TOP_TTL_MS) return res.json(topCache.data);

    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: rows, error } = await fetchAll(() => supabase
      .from('watch_history')
      .select('id, user_id, content_type, content_id, series_id, progress, completed')
      .gte('last_watched', since)
      .order('id'));
    if (error) throw error;

    const viewers = new Map(); // "movie:id" | "series:id" -> Set de contas
    for (const r of rows || []) {
      if (!r.completed && (r.progress || 0) < 60) continue; // abriu e fechou não conta
      const id = r.content_type === 'movie' ? r.content_id : r.series_id;
      if (!id) continue;
      const key = `${r.content_type === 'movie' ? 'movie' : 'series'}:${id}`;
      if (!viewers.has(key)) viewers.set(key, new Set());
      viewers.get(key).add(r.user_id);
    }

    // Pega folga (30) porque alguns títulos podem ter sido desativados
    const ranked = [...viewers.entries()]
      .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
      .slice(0, 30)
      .map(([key]) => { const [content_type, id] = key.split(':'); return { content_type, id }; });

    const idsOf = type => ranked.filter(r => r.content_type === type).map(r => r.id);
    const [movies, series] = await Promise.all([
      idsOf('movie').length
        ? supabase.from('movies').select('id, title, synopsis, year, rating, genres, poster_url, backdrop_url, age_rating').eq('is_active', true).in('id', idsOf('movie'))
        : { data: [] },
      idsOf('series').length
        ? supabase.from('series').select('id, title, synopsis, year_start, rating, genres, poster_url, backdrop_url, age_rating, total_seasons').eq('is_active', true).in('id', idsOf('series'))
        : { data: [] },
    ]);
    const detail = new Map([
      ...(movies.data || []).map(m => [`movie:${m.id}`, { ...m, content_type: 'movie' }]),
      ...(series.data || []).map(s => [`series:${s.id}`, { ...s, content_type: 'series' }]),
    ]);

    const top = ranked
      .map(r => detail.get(`${r.content_type}:${r.id}`))
      .filter(Boolean)
      .slice(0, 10)
      .map((item, i) => ({ ...item, rank: i + 1 }));

    topCache = { at: Date.now(), data: top };
    res.json(top);
  } catch (err) {
    console.error('[top10] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

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

    // Títulos marcados como "já assistido" não voltam como recomendação
    let marksQ = supabase.from('watched_marks').select('content_type, content_id').eq('user_id', req.user.id);
    marksQ = profileId ? marksQ.eq('profile_id', profileId) : marksQ.is('profile_id', null);
    const { data: marks } = await marksQ; // tabela ausente = nenhuma marca
    const marked = new Set((marks || []).map(m => `${m.content_type}:${m.content_id}`));

    // Assinatura do histórico: mesma lista de títulos => mesmo resultado (estável).
    const sig = history.slice(0, 30).map(h => `${h.content_type}:${h.series_id || h.content_id}`).join('|') + '#' + [...marked].sort().join('|');
    const cacheKey = `${req.user.id}:${profileId || 'default'}:${limit}:${require('crypto').createHash('md5').update(sig).digest('hex')}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

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
        ? supabase.from('movies').select('id, genres, tmdb_id').in('id', watchedMovieIds)
        : { data: [] },
      watchedSeriesIds.length > 0
        ? supabase.from('series').select('id, genres, tmdb_id').in('id', watchedSeriesIds)
        : { data: [] },
    ]);
    const movieGenresMap = Object.fromEntries((watchedMoviesRes.data || []).map(m => [m.id, m.genres || []]));
    const seriesGenresMap = Object.fromEntries((watchedSeriesRes.data || []).map(s => [s.id, s.genres || []]));
    const movieTmdbMap = Object.fromEntries((watchedMoviesRes.data || []).map(m => [m.id, m.tmdb_id]));
    const seriesTmdbMap = Object.fromEntries((watchedSeriesRes.data || []).map(s => [s.id, s.tmdb_id]));

    // Score de afinidade por gênero: soma dos pesos (por recência) de cada
    // vez que o gênero apareceu no histórico.
    const affinity = {};
    // Peso de cada título assistido (maior ocorrência = mais recente = usa
    // o peso da primeira aparição no histórico, que é o maior).
    const seedWeight = new Map(); // key: `${type}:${tmdbId}` -> weight
    history.forEach((h, idx) => {
      const weight = Math.pow(DECAY, idx);
      const genres = h.content_type === 'movie'
        ? (movieGenresMap[h.content_id] || [])
        : (seriesGenresMap[h.series_id] || []);
      genres.forEach(g => { affinity[g] = (affinity[g] || 0) + weight; });

      const type = h.content_type === 'movie' ? 'movie' : 'series';
      const tmdbId = h.content_type === 'movie' ? movieTmdbMap[h.content_id] : seriesTmdbMap[h.series_id];
      if (tmdbId) {
        const key = `${type}:${tmdbId}`;
        if (!seedWeight.has(key)) seedWeight.set(key, weight); // só a 1ª (mais recente)
      }
    });

    const topGenres = Object.keys(affinity);
    if (topGenres.length === 0) return res.json([]);

    // Busca "parecidos" no TMDB pros títulos assistidos mais recentes — sinal
    // mais específico (sinopse/elenco/palavras-chave), não só o rótulo de gênero.
    const seeds = [...seedWeight.entries()].slice(0, TMDB_SEED_COUNT);
    const tmdbBoost = { movie: {}, series: {} }; // tmdb_id -> score
    // withTimeout em cada chamada: se o TMDB não responder a tempo, essa
    // semente simplesmente não contribui (cai pra afinidade de gênero puro),
    // em vez de segurar a resposta inteira esperando a API externa.
    await Promise.all(seeds.map(async ([key, weight]) => {
      const [type, tmdbId] = key.split(':');
      const similarIds = await getSimilar(tmdbId, type, TMDB_OVERALL_TIMEOUT_MS);
      similarIds.forEach((id, pos) => {
        const contribution = weight * (1 / (pos + 1));
        tmdbBoost[type][id] = (tmdbBoost[type][id] || 0) + contribution;
      });
    }));

    // Catálogo inteiro (sem limit, sem filtro de gênero) — só colunas leves
    // pra pontuar. Com 500+ filmes um limit sem ORDER BY deixava parte do
    // catálogo fora da pontuação de forma arbitrária; e filtrar só por
    // overlap de gênero deixava de fora um "parecido" do TMDB com gênero
    // ligeiramente diferente.
    const [allMoviesRes, allSeriesRes] = await Promise.all([
      supabase.from('movies').select('id, genres, tmdb_id').eq('is_active', true),
      supabase.from('series').select('id, genres, tmdb_id').eq('is_active', true),
    ]);

    const watchedMovieSet = new Set(watchedMovieIds);
    const watchedSeriesSet = new Set(watchedSeriesIds);

    function scoreOf(genres, type, tmdbId) {
      const genreScore = (genres || []).reduce((sum, g) => sum + (affinity[g] || 0), 0);
      const boost = tmdbId ? (tmdbBoost[type][tmdbId] || 0) : 0;
      return Math.round((genreScore + boost * TMDB_BOOST) * 10000) / 10000;
    }

    const scoredMovies = (allMoviesRes.data || [])
      .filter(m => !watchedMovieSet.has(m.id) && !marked.has(`movie:${m.id}`))
      .map(m => ({ id: m.id, content_type: 'movie', _score: scoreOf(m.genres, 'movie', m.tmdb_id) }))
      .filter(m => m._score > 0);

    const scoredSeries = (allSeriesRes.data || [])
      .filter(s => !watchedSeriesSet.has(s.id) && !marked.has(`series:${s.id}`))
      .map(s => ({ id: s.id, content_type: 'series', _score: scoreOf(s.genres, 'series', s.tmdb_id) }))
      .filter(s => s._score > 0);

    const topIds = [...scoredMovies, ...scoredSeries]
      // desempate por id: sem isso, títulos com a mesma nota trocavam de lugar a cada chamada
      .sort((a, b) => (b._score - a._score) || String(a.id).localeCompare(String(b.id)))
      .slice(0, limit);

    const topMovieIds = topIds.filter(t => t.content_type === 'movie').map(t => t.id);
    const topSeriesIds = topIds.filter(t => t.content_type === 'series').map(t => t.id);

    // Só agora busca os dados completos (sinopse, poster etc.) — só dos
    // selecionados, não do catálogo inteiro.
    const [moviesDetailRes, seriesDetailRes] = await Promise.all([
      topMovieIds.length
        ? supabase.from('movies')
            .select('id, title, synopsis, year, rating, genres, poster_url, backdrop_url, age_rating, file_dubbing, file_subtitled, file_cinema, file_4k')
            .in('id', topMovieIds)
        : { data: [] },
      topSeriesIds.length
        ? supabase.from('series')
            .select('id, title, synopsis, year_start, rating, genres, poster_url, backdrop_url, age_rating, total_seasons')
            .in('id', topSeriesIds)
        : { data: [] },
    ]);
    const detailMap = new Map([
      ...(moviesDetailRes.data || []).map(m => [`movie:${m.id}`, { ...m, content_type: 'movie' }]),
      ...(seriesDetailRes.data || []).map(s => [`series:${s.id}`, { ...s, content_type: 'series' }]),
    ]);

    const results = topIds
      .map(t => detailMap.get(`${t.content_type}:${t.id}`))
      .filter(Boolean);

    setCached(cacheKey, results);
    res.json(results);
  } catch (err) {
    console.error('[recommendations] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
