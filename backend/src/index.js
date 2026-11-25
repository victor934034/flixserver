require('../instrument'); // Sentry — tem que ser o 1º require de todos
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
const recommendationsRouter = require('./routes/recommendations');
const webhookRouter = require('./routes/webhook');
const castRouter = require('./routes/cast');
const profilesRouter = require('./routes/profiles');
const settingsRouter = require('./routes/settings');
const paymentsRouter = require('./routes/payments');
const suggestionsRouter = require('./routes/suggestions');
const streamsRouter = require('./routes/streams');
const likesRouter = require('./routes/likes');
const iptvRouter = require('./routes/iptv');
const remuxRouter = require('./routes/remux');
const subtitleRouter = require('./routes/subtitle');
const collectionsRouter = require('./routes/collections');
const helpRouter = require('./routes/help');
const chatRouter = require('./routes/chat');
const securityRouter = require('./routes/security');
const togetherRouter = require('./routes/together');
const referralsRouter = require('./routes/referrals');
const watchedRouter = require('./routes/watched');
const { blocklistMiddleware } = require('./services/guard');

const REQUIRED_ENV = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Variáveis de ambiente obrigatórias ausentes: ${missingEnv.join(', ')}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 20) {
  console.error('JWT_SECRET muito curto/fraco — use uma string aleatória com pelo menos 20 caracteres.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  console.warn('[aviso] FRONTEND_URL não definido em produção — CORS liberará qualquer origem.');
}

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1); // EasePanel proxy adds X-Forwarded-For

app.disable('x-powered-by');
app.use(helmet({
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // imagens/legendas servidas a outros apps
}));

// Transmissão do IPTV pro Chromecast: o receiver (outra origem) busca lista e trechos
// direto aqui, então esta rota é aberta a qualquer origem e fica ANTES do CORS restrito.
// O acesso é protegido pelo token/assinatura de cada endereço, não pela origem.
const iptvCast = require('./routes/iptvCast');
app.use('/api/iptv/cast', (req, res, next) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Expose-Headers': '*' });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}, iptvCast.router);

// CORS: FRONTEND_URL + CORS_ORIGINS (lista separada por vírgula, ex.: TVs/PWAs).
// Apps nativos não mandam Origin, então não são afetados.
const allowedOrigins = [process.env.FRONTEND_URL, ...(process.env.CORS_ORIGINS || '').split(',')]
  .map(o => (o || '').trim().replace(/\/$/, '')).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length
    ? (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin))
    : '*',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // 500 era baixo para uma casa com vários dispositivos (TV + celular + web)
  // atrás do mesmo IP, todos com heartbeat/history rodando ao mesmo tempo —
  // um deles travando e reconectando em loop já estourava e derrubava os outros.
  max: 2000,
  message: { error: 'Muitas requisições, tente novamente em alguns minutos.' },
  // Exclui auth (tem limiter próprio) e upload (admin autenticado, muitas requisições de partes)
  // Cast do IPTV baixa um trecho a cada poucos segundos: contaria como centenas de requisições
  skip: (req) => req.path.startsWith('/auth/') || req.path.startsWith('/upload/') || req.path.startsWith('/iptv/cast/'),
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

const tvCodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Muitas tentativas. Aguarde um minuto.' },
});
app.use('/api/auth/tv/code', tvCodeLimiter);

// Bloqueio por IP/dispositivo (lista gerenciada no admin). Webhooks e health ficam de fora.
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/webhook') || req.path.startsWith('/payments/webhook')) return next();
  return blocklistMiddleware(req, res, next);
});

// Rotas sensíveis a abuso (cadastro, recuperação de senha, pagamento)
const strictLimiter = (max, windowMs = 15 * 60 * 1000) => rateLimit({
  windowMs, max,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos.' },
});
app.use('/api/auth/register', strictLimiter(20));
app.use('/api/auth/register-with-otp', strictLimiter(20));
app.use('/api/auth/forgot-password', strictLimiter(10));
app.use('/api/auth/reset-password', strictLimiter(15));
app.use('/api/payments/checkout', strictLimiter(15));
app.use('/api/payments/trial/start', strictLimiter(10));
app.use('/api/referrals/apply', strictLimiter(10));
app.use('/api/admin', strictLimiter(1500));

app.use('/api/movies', moviesRouter);
app.use('/api/series', seriesRouter);
app.use('/api/episodes', episodesRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/tmdb', tmdbRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/history', historyRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/cast', castRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/streams', streamsRouter);
app.use('/api/likes', likesRouter);
app.use('/api/iptv', iptvRouter);
app.use('/api/remux', remuxRouter);
app.use('/api/subtitle', subtitleRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/help', helpRouter);
app.use('/api/security', securityRouter);
app.use('/api/together', togetherRouter);
app.use('/api/referrals', referralsRouter);
app.use('/api/watched', watchedRouter);

// ── Versão do conteúdo: apps/site consultam isso e recarregam a Home sozinhos
// quando você adiciona filme, troca banner etc. (sem precisar fechar o app).
let contentBumpedAt = Date.now();
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      /^\/(admin|movies|series|episodes|collections|upload|tmdb|help)/.test(req.path)) {
    res.on('finish', () => { if (res.statusCode < 400) contentBumpedAt = Date.now(); });
  }
  next();
});
let versionCache = { at: 0, v: 0 };
app.get('/api/content-version', async (req, res) => {
  try {
    if (Date.now() - versionCache.at > 15000) {
      const { supabase } = require('./services/supabase');
      const [m, se, ep] = await Promise.all([
        supabase.from('movies').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('series').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('episodes').select('created_at').order('created_at', { ascending: false }).limit(1),
      ]);
      const ts = [m.data?.[0]?.updated_at, se.data?.[0]?.updated_at, ep.data?.[0]?.created_at]
        .filter(Boolean).map(t => new Date(t).getTime());
      versionCache = { at: Date.now(), v: Math.max(0, ...ts) };
    }
    res.set('Cache-Control', 'no-store');
    res.json({ v: Math.max(contentBumpedAt, versionCache.v) });
  } catch {
    res.json({ v: contentBumpedAt });
  }
});

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
    const { searchIds, orderByIds } = require('./services/titleSearch');
    const [mIds, sIds, eIds] = await Promise.all([
      (type === 'series' || type === 'episode' || !!epRef) ? [] : searchIds('movies', titleQ, lim),
      type === 'movie' || type === 'episode' ? [] : searchIds('series', titleQ, lim),
      type === 'movie' || type === 'series' ? [] : searchIds('episodes', titleQ, lim),
    ]);

    const byIds = async (table, cols, ids, withGenre) => {
      if (!ids.length) return { data: [] };
      let q = supabase.from(table).select(cols).in('id', ids);
      if (table !== 'episodes') q = q.eq('is_active', true);
      if (genre && withGenre) q = q.contains('genres', [genre]);
      const r = await q;
      return { data: orderByIds(r.data || [], ids) };
    };

    const [moviesResult, seriesResult, episodesResult] = await Promise.all([
      byIds('movies', 'id, title, year, poster_url, rating, genres', mIds, true),
      byIds('series', 'id, title, year_start, poster_url, rating, genres', sIds, true),
      byIds('episodes', 'id, title, season_number, episode_number, thumbnail_url, series_id, series:series_id(id, title, poster_url)', eIds, false),
    ]);

    let seriesData = seriesResult.data || [];

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
    const MCOLS = 'id, title, synopsis, year, poster_url, backdrop_url, trailer_url, rating, genres, file_dubbing, file_subtitled, file_cinema, file_4k, file_color, file_bw';
    const SCOLS = 'id, title, synopsis, year_start, poster_url, backdrop_url, trailer_url, rating, genres';
    // Banner = marcados "No banner" no admin (ordem banner_order). Sem nenhum? cai no antigo "destaque".
    const run = (flag, order) => Promise.all([
      supabase.from('movies').select(MCOLS + ', ' + order).eq(flag, true).eq('is_active', true).order(order).limit(15),
      supabase.from('series').select(SCOLS + ', ' + order).eq(flag, true).eq('is_active', true).order(order).limit(15),
    ]);
    let [moviesResult, seriesResult] = await run('in_banner', 'banner_order');
    if (moviesResult.error || seriesResult.error || ((moviesResult.data || []).length + (seriesResult.data || []).length) === 0) {
      [moviesResult, seriesResult] = await run('is_featured', 'featured_order');
      (moviesResult.data || []).forEach(x => { x.banner_order = x.featured_order; });
      (seriesResult.data || []).forEach(x => { x.banner_order = x.featured_order; });
    }

    const seriesIds = (seriesResult.data || []).map(s => s.id);
    let bwSet = new Set();
    if (seriesIds.length) {
      const { data: bwEps } = await supabase.from('episodes').select('series_id').in('series_id', seriesIds).not('file_bw', 'is', null);
      bwSet = new Set((bwEps || []).map(e => e.series_id));
    }

    const items = [
      ...(moviesResult.data || []).map(m => ({ ...m, type: 'movie' })),
      ...(seriesResult.data || []).map(s => ({ ...s, type: 'series', has_bw: bwSet.has(s.id) })),
    ].sort((a, b) => (a.banner_order ?? 99) - (b.banner_order ?? 99));

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

// Captura o erro no Sentry ANTES do handler final — precisa vir depois de
// todas as rotas e antes do error handler de verdade.
require('@sentry/node').setupExpressErrorHandler(app);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const httpServer = require('http').createServer(app);
require('./services/together').attach(httpServer); // Socket.IO (Assistir juntos)
httpServer.listen(PORT, () => {
  console.log(`🚀 Flixhome API rodando na porta ${PORT}`);

  if (process.env.BACKBLAZE_KEY_ID && process.env.BACKBLAZE_BUCKET_ID) {
    const { setupCors } = require('./services/backblaze');
    setupCors();
  }

  // Cron: avisa usuários com assinatura (app ou IPTV) prestes a expirar
  const { sendExpiryWarnings } = require('./services/notifications');
  const { supabase } = require('./services/supabase');

  const runExpiryWarnings = () =>
    sendExpiryWarnings(supabase).catch(e => console.error('[cron] expiry warnings:', e.message));

  // Primeira execução 2 minutos após boot (servidor estabilizar)
  setTimeout(runExpiryWarnings, 2 * 60 * 1000);
  // Depois, a cada 12 horas
  setInterval(runExpiryWarnings, 12 * 60 * 60 * 1000);

  // Cron: avisa quem tem a série na "Minha Lista" quando sai episódio novo
  const { sendNewEpisodeAlerts } = require('./services/notifications');
  const runEpisodeAlerts = () =>
    sendNewEpisodeAlerts(supabase).catch(e => console.error('[cron] episode alerts:', e.message));
  setTimeout(runEpisodeAlerts, 3 * 60 * 1000);
  setInterval(runEpisodeAlerts, 30 * 60 * 1000);

  // Cron: avisa quem teve o pedido (sugestão) atendido
  const { checkFulfilledSuggestions } = require('./services/suggestionAlerts');
  const runSuggestionAlerts = () =>
    checkFulfilledSuggestions(supabase).catch(e => console.error('[cron] pedidos atendidos:', e.message));
  setTimeout(runSuggestionAlerts, 4 * 60 * 1000);
  setInterval(runSuggestionAlerts, 15 * 60 * 1000);
});
