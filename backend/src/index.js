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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Muitas requisições, tente novamente em alguns minutos.' },
});
app.use('/api/', limiter);

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/search', async (req, res) => {
  const { q, type, limit = 20 } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query deve ter pelo menos 2 caracteres' });
  }

  const { supabase } = require('./services/supabase');
  const search = `%${q}%`;

  try {
    const [moviesResult, seriesResult] = await Promise.all([
      type !== 'series'
        ? supabase.from('movies').select('id, title, year, poster_url, rating, genres').ilike('title', search).eq('is_active', true).limit(Number(limit))
        : Promise.resolve({ data: [] }),
      type !== 'movie'
        ? supabase.from('series').select('id, title, year_start, poster_url, rating, genres').ilike('title', search).eq('is_active', true).limit(Number(limit))
        : Promise.resolve({ data: [] }),
    ]);

    res.json({
      movies: (moviesResult.data || []).map(m => ({ ...m, type: 'movie' })),
      series: (seriesResult.data || []).map(s => ({ ...s, type: 'series' })),
    });
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
