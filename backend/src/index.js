require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const moviesRouter = require('./routes/movies');
const seriesRouter = require('./routes/series');
const episodesRouter = require('./routes/episodes');
const uploadRouter = require('./routes/upload');
const tmdbRouter = require('./routes/tmdb');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const watchlistRouter = require('./routes/watchlist');
const historyRouter = require('./routes/history');
const webhookRouter = require('./routes/webhook');
const castRouter = require('./routes/cast');
const profilesRouter = require('./routes/profiles');
const settingsRouter = require('./routes/settings');
const paymentsRouter = require('./routes/payments');
const suggestionsRouter = require('./routes/suggestions');
const streamsRouter = require('./routes/streams');
const likesRouter = require('./routes/likes');
const iptvRouter = require('./routes/iptv');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1); // EasePanel proxy adds X-Forwarded-For

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Muitas requisições, tente novamente em alguns minutos.' },
  // Exclui auth (tem limiter próprio) e upload (admin autenticado, muitas requisições de partes)
  skip: (req) => req.path.startsWith('/auth/') || req.path.startsWith('/upload/'),
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/send-otp', authLimiter);
app.use('/api/auth/verify-otp', authLimiter);

app.use('/api/movies', moviesRouter);
app.use('/api/series', seriesRouter);
app.use('/api/episodes', episodesRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/tmdb', tmdbRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/history', historyRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/cast', castRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/streams', streamsRouter);
app.use('/api/likes', likesRouter);
app.use('/api/iptv', iptvRouter);

app.get('/api/preset-avatars', async (req, res) => {
  const { supabase } = require('./services/supabase');
  const { kids } = req.query;
  let query = supabase.from('preset_avatars').select('id, url, label, is_kids').eq('is_active', true).order('order_index').order('created_at');
  if (kids === 'true') query = query.eq('is_kids', true);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Detecta referência de episódio no final da query (ex: "3x1", "EP 3x1", "S03E01", "T3E1")
function parseEpisodeRef(q) {
  const patterns = [
    /\b(?:ep(?:is[oó]dio)?\s*)?(\d+)\s*[xX]\s*(\d+)\b/i, // 3x1, EP 3x1, EP3x1
    /\b[sStT](\d+)\s*[eExX]\s*(\d+)\b/,                   // S03E01, T3E1, S3x1
  ];
  for (const re of patterns) {
    const m = q.match(re);
    if (m) {
      return {
        season: parseInt(m[1], 10),
        episode: parseInt(m[2], 10),
        // Remove "EP" ou "EP." sobrando antes do número, e espaços extras
        titlePart: q.slice(0, m.index)
          .replace(/\bep\.?\s*$/i, '')
          .replace(/\s+/g, ' ')
          .trim(),
      };
    }
  }
  return null;
}

app.get('/api/search', async (req, res) => {
  const { q, type, genre, limit = 20 } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query deve ter pelo menos 2 caracteres' });
  }

  const { supabase } = require('./services/supabase');
  const lim = Number(limit);

  // Normaliza query no estilo de filename: pontos viram espaços
  // "Chicago.P.D.Distrito.21.EP.3x1" → "Chicago P D Distrito 21 EP 3x1"
  const normalizedQ = q.trim().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();

  // Detecta padrão "3x1" / "EP 3x1" / "S03E01" na query
  const epRef = parseEpisodeRef(normalizedQ);
  const titleQ = epRef && epRef.titlePart.length >= 2 ? epRef.titlePart : normalizedQ;
  const search = `%${titleQ}%`;

  try {
    let moviesQ = supabase.from('movies').select('id, title, year, poster_url, rating, genres').ilike('title', search).eq('is_active', true).limit(lim);
    let seriesQ = supabase.from('series').select('id, title, year_start, poster_url, rating, genres').ilike('title', search).eq('is_active', true).limit(lim);
    let episodesQ = supabase.from('episodes').select('id, title, season_number, episode_number, thumbnail_url, series_id, series:series_id(id, title, poster_url)').ilike('title', search).limit(lim);

    if (genre) {
      moviesQ = moviesQ.contains('genres', [genre]);
      seriesQ = seriesQ.contains('genres', [genre]);
    }

    const [moviesResult, seriesResult, episodesResult] = await Promise.all([
      // Se tem referência de episódio (3x1, S03E01…), não busca filmes
      (type === 'series' || type === 'episode' || !!epRef) ? Promise.resolve({ data: [] }) : moviesQ,
      type === 'movie' || type === 'episode' ? Promise.resolve({ data: [] }) : seriesQ,
      type === 'movie' || type === 'series' ? Promise.resolve({ data: [] }) : episodesQ,
    ]);

    // Fallback fuzzy para séries: ignora ":", "·", traços extras no título
    // Ex: "Chicago P.D Distrito 21" encontra "Chicago P.D.: Distrito 21"
    let seriesData = seriesResult.data || [];
    if (seriesData.length === 0 && titleQ.length >= 4 && type !== 'movie' && type !== 'episode') {
      const fuzzy = '%' + titleQ.trim().split(/\s+/).filter(Boolean).join('%') + '%';
      const { data: fuzzyData } = await supabase
        .from('series')
        .select('id, title, year_start, poster_url, rating, genres')
        .ilike('title', fuzzy)
        .eq('is_active', true)
        .limit(lim);
      if (fuzzyData && fuzzyData.length > 0) seriesData = fuzzyData;
    }

    let episodes = (episodesResult.data || []).map(e => ({
      ...e, type: 'episode',
      poster_url: e.series?.poster_url || e.thumbnail_url,
      seriesTitle: e.series?.title,
    }));

    // Se detectou referência de episódio (3x1), busca o episódio específico nas séries encontradas
    if (epRef && type !== 'movie') {
      const seriesIds = seriesData.map(s => s.id);
      if (seriesIds.length > 0) {
        const { data: epData } = await supabase
          .from('episodes')
          .select('id, title, season_number, episode_number, thumbnail_url, series_id, series:series_id(id, title, poster_url)')
          .in('series_id', seriesIds)
          .eq('season_number', epRef.season)
          .eq('episode_number', epRef.episode)
          .limit(5);

        if (epData && epData.length > 0) {
          const pinned = epData.map(e => ({
            ...e, type: 'episode',
            poster_url: e.series?.poster_url || e.thumbnail_url,
            seriesTitle: e.series?.title,
          }));
          // Coloca os episódios específicos no topo, sem duplicar
          const existingIds = new Set(episodes.map(e => e.id));
          episodes = [...pinned, ...episodes.filter(e => !existingIds.has(e.id))];
        }
      }
    }

    res.json({
      movies: (moviesResult.data || []).map(m => ({ ...m, type: 'movie' })),
      series: seriesData.map(s => ({ ...s, type: 'series' })),
      episodes,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Categorias/gêneros dinâmicos — extraídos dos filmes e séries cadastrados
app.get('/api/genres', async (req, res) => {
  const { supabase } = require('./services/supabase');
  try {
    const [moviesRes, seriesRes] = await Promise.all([
      supabase.from('movies').select('genres').eq('is_active', true),
      supabase.from('series').select('genres').eq('is_active', true),
    ]);
    const set = new Set();
    [...(moviesRes.data || []), ...(seriesRes.data || [])].forEach(row => {
      (row.genres || []).forEach(g => { if (g) set.add(g); });
    });
    res.json([...set].sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/featured', async (req, res) => {
  const { supabase } = require('./services/supabase');
  try {
    const [moviesResult, seriesResult] = await Promise.all([
      supabase.from('movies').select('id, title, synopsis, year, poster_url, backdrop_url, trailer_url, rating, genres').eq('is_featured', true).eq('is_active', true).order('featured_order').limit(10),
      supabase.from('series').select('id, title, synopsis, year_start, poster_url, backdrop_url, trailer_url, rating, genres').eq('is_featured', true).eq('is_active', true).order('featured_order').limit(10),
    ]);

    const items = [
      ...(moviesResult.data || []).map(m => ({ ...m, type: 'movie' })),
      ...(seriesResult.data || []).map(s => ({ ...s, type: 'series' })),
    ].sort((a, b) => (a.featured_order || 99) - (b.featured_order || 99));

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/categories', async (req, res) => {
  const { supabase } = require('./services/supabase');
  try {
    const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('order_index');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 Flixhome API rodando na porta ${PORT}`);
  // Configure B2 bucket CORS so browsers can upload directly
  if (process.env.BACKBLAZE_KEY_ID && process.env.BACKBLAZE_BUCKET_ID) {
    const { setupCors } = require('./services/backblaze');
    setupCors();
  }
});
