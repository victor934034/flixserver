const { fetchAll } = require('./supabase');

// Painel "o que as pessoas assistem": mais vistos, abandonados no começo e
// pedidos mais repetidos. Sempre conta CONTAS diferentes, não reproduções.

const STARTED_SECONDS = 60;                    // menos que isso é só "abriu e fechou"
const ABANDON_RATIO = 0.15;                    // parou antes de 15% do vídeo
const ABANDON_IDLE_MS = 2 * 86400000;          // e não voltou em 2 dias

const topOf = (map, n = 15) => [...map.entries()]
  .map(([key, set]) => ({ key, count: set.size }))
  .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
  .slice(0, n);

const add = (map, key, userId) => {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(userId);
};

async function titlesFor(supabase, keys) {
  const idsOf = type => [...new Set(keys.filter(k => k.startsWith(type + ':')).map(k => k.split(':')[1]))];
  const out = new Map();
  for (const [type, table] of [['movie', 'movies'], ['series', 'series']]) {
    const ids = idsOf(type);
    if (!ids.length) continue;
    const { data, error } = await supabase.from(table).select('id, title, poster_url').in('id', ids);
    if (error) throw error;
    (data || []).forEach(r => out.set(`${type}:${r.id}`, r));
  }
  return out;
}

async function buildInsights(supabase, days) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data: rows, error } = await fetchAll(() => supabase
    .from('watch_history')
    .select('id, user_id, content_type, content_id, series_id, progress, duration, completed, last_watched')
    .gte('last_watched', since)
    .order('id'));
  if (error) throw error;

  const watched = new Map(), abandoned = new Map(), accounts = new Set();
  const idleBefore = new Date(Date.now() - ABANDON_IDLE_MS).toISOString();
  for (const r of rows || []) {
    if ((r.progress || 0) < STARTED_SECONDS) continue;
    const isMovie = r.content_type === 'movie';
    const id = isMovie ? r.content_id : r.series_id;
    if (!id) continue;
    const key = `${isMovie ? 'movie' : 'series'}:${id}`;
    accounts.add(r.user_id);
    add(watched, key, r.user_id);
    if (!r.completed && r.duration > 0 && r.progress / r.duration < ABANDON_RATIO && r.last_watched < idleBefore) {
      add(abandoned, key, r.user_id);
    }
  }
  // Em série, quem passou de um episódio seguiu assistindo: não é abandono
  const engaged = new Map();
  for (const r of rows || []) {
    if (r.content_type !== 'episode' || !r.series_id) continue;
    if (r.completed || (r.duration > 0 && r.progress / r.duration >= ABANDON_RATIO)) add(engaged, `series:${r.series_id}`, r.user_id);
  }
  for (const [key, users] of abandoned) {
    for (const u of engaged.get(key) || []) users.delete(u);
    if (!users.size) abandoned.delete(key);
  }

  const { data: suggestions, error: sugError } = await fetchAll(() => supabase
    .from('suggestions')
    .select('id, user_id, title, type, tmdb_id, poster_url, status')
    .in('status', ['pending', 'approved'])
    .order('id'));
  if (sugError) throw sugError;

  const requests = new Map(), info = new Map();
  for (const s of suggestions || []) {
    const key = `${s.type}:${s.tmdb_id || String(s.title).trim().toLowerCase()}`;
    add(requests, key, s.user_id);
    if (!info.has(key)) info.set(key, { title: s.title, type: s.type, poster_url: s.poster_url });
  }

  const watchedTop = topOf(watched), abandonedTop = topOf(abandoned);
  const titles = await titlesFor(supabase, [...watchedTop, ...abandonedTop].map(i => i.key));
  const describe = list => list.map(({ key, count }) => {
    const t = titles.get(key);
    return t ? { content_type: key.split(':')[0], id: t.id, title: t.title, poster_url: t.poster_url, accounts: count } : null;
  }).filter(Boolean);

  return {
    days,
    active_accounts: accounts.size,
    titles_watched: watched.size,
    most_watched: describe(watchedTop),
    abandoned: describe(abandonedTop).map(i => ({ ...i, watched_by: watched.get(`${i.content_type}:${i.id}`).size })),
    requests: topOf(requests, 20).map(({ key, count }) => ({ ...info.get(key), accounts: count })),
  };
}

module.exports = { buildInsights };
