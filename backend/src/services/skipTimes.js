const axios = require('axios');

// Tempos de abertura e créditos de cada episódio, vindos do IntroDB (introdb.app).
// Os termos deles permitem app comercial com uso razoável e proíbem varrer a base:
// por isso só buscamos o episódio que alguém ABRIU, e guardamos o resultado.

const INTRODB_URL = 'https://api.introdb.app/segments';
const FOUND_TTL_MS = 30 * 86400000;  // achou: confere de novo em 30 dias
const EMPTY_TTL_MS = 3 * 86400000;   // não achou: tenta de novo em 3 dias (alguém pode ter enviado)
const MAX_PER_MINUTE = 40;           // teto de consultas ao IntroDB, bem folgado pro uso normal
const BACKOFF_MS = 5 * 60 * 1000;    // quando eles pedem pra parar

const memory = new Map();    // cópia em memória (vale também sem a tabela no banco)
const imdbIds = new Map();   // tmdb da série -> imdb
const pending = new Map();   // evita duas buscas iguais ao mesmo tempo
let recent = [];
let blockedUntil = 0;

const EMPTY = Object.freeze({ intro_start: null, intro_end: null, credits_start: null, source: null });

const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 10) / 10);

// Descarta o que não faz sentido. A conferência contra a duração do vídeo é
// feita no player, que é quem sabe a duração do arquivo.
function sanitize({ intro_start, intro_end, credits_start }) {
  let start = num(intro_start), end = num(intro_end), credits = num(credits_start);
  if (end !== null && start === null) start = 0;
  if (end === null || start < 0 || start > 1500 || end - start < 5 || end - start > 400) { start = null; end = null; }
  if (credits !== null && (credits < 120 || (end !== null && credits <= end))) credits = null;
  return { intro_start: start, intro_end: end, credits_start: credits };
}

const hasAny = r => r.intro_end !== null || r.credits_start !== null;
const publicView = r => ({ intro_start: r.intro_start, intro_end: r.intro_end, credits_start: r.credits_start, source: r.source });
const fromRow = row => ({
  intro_start: num(row.intro_start), intro_end: num(row.intro_end), credits_start: num(row.credits_start),
  source: row.source || null, manual: !!row.manual, checked_at: new Date(row.checked_at).getTime(),
});
const fresh = r => r.manual || Date.now() - r.checked_at < (hasAny(r) ? FOUND_TTL_MS : EMPTY_TTL_MS);

async function readStored(supabase, episodeId) {
  const { data, error } = await supabase.from('episode_skip_times').select('*').eq('episode_id', episodeId).maybeSingle();
  if (error || !data) return memory.get(episodeId) || null; // sem a migração, vale a memória
  return fromRow(data);
}

async function store(supabase, episodeId, result) {
  memory.set(episodeId, result);
  if (memory.size > 5000) memory.delete(memory.keys().next().value);
  const { error } = await supabase.from('episode_skip_times').upsert({
    episode_id: episodeId, intro_start: result.intro_start, intro_end: result.intro_end, credits_start: result.credits_start,
    source: result.source, manual: result.manual, checked_at: new Date(result.checked_at).toISOString(),
  }, { onConflict: 'episode_id' });
  return !error;
}

async function imdbIdOf(tmdbId) {
  if (imdbIds.has(tmdbId)) return imdbIds.get(tmdbId);
  const { data } = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}/external_ids`, {
    params: { api_key: process.env.TMDB_API_KEY }, timeout: 6000,
  });
  const id = /^tt\d+$/.test(data?.imdb_id || '') ? data.imdb_id : null;
  imdbIds.set(tmdbId, id);
  return id;
}

// Retorna os tempos, EMPTY quando a base não tem, ou null quando não deu pra consultar
async function askIntroDb(imdbId, season, episode) {
  const now = Date.now();
  recent = recent.filter(t => now - t < 60000);
  if (now < blockedUntil || recent.length >= MAX_PER_MINUTE) return null;
  recent.push(now);
  try {
    const { data } = await axios.get(INTRODB_URL, {
      params: { imdb_id: imdbId, season, episode }, timeout: 6000, headers: { 'User-Agent': 'streaming-player/1.0' },
    });
    return sanitize({
      intro_start: data?.intro?.start_sec, intro_end: data?.intro?.end_sec, credits_start: data?.outro?.start_sec,
    });
  } catch (e) {
    const status = e.response?.status;
    if (status === 404) return sanitize(EMPTY);
    if (status === 429 || status === 403) blockedUntil = Date.now() + BACKOFF_MS;
    console.error('[abertura] IntroDB:', status || e.message);
    return null;
  }
}

async function lookup(supabase, episodeId, stored) {
  const { data: ep } = await supabase.from('episodes').select('series_id, season_number, episode_number').eq('id', episodeId).maybeSingle();
  if (!ep) return EMPTY;
  const { data: serie } = await supabase.from('series').select('tmdb_id').eq('id', ep.series_id).maybeSingle();

  let found = sanitize(EMPTY);
  if (serie?.tmdb_id && ep.season_number > 0) { // especiais (temporada 0) não têm numeração confiável
    let imdbId;
    try { imdbId = await imdbIdOf(serie.tmdb_id); } catch { return stored ? publicView(stored) : EMPTY; }
    if (imdbId) {
      found = await askIntroDb(imdbId, ep.season_number, ep.episode_number);
      // falha de rede não vira "não tem": usa o que já havia e tenta na próxima
      if (!found) return stored ? publicView(stored) : EMPTY;
    }
  }

  const result = { ...found, source: hasAny(found) ? 'introdb' : null, manual: false, checked_at: Date.now() };
  await store(supabase, episodeId, result);
  return publicView(result);
}

async function getSkipTimes(supabase, episodeId) {
  const stored = await readStored(supabase, episodeId);
  if (stored && fresh(stored)) return publicView(stored);
  if (!pending.has(episodeId)) {
    pending.set(episodeId, lookup(supabase, episodeId, stored).finally(() => pending.delete(episodeId)));
  }
  return pending.get(episodeId);
}

// Correção feita no admin: nunca é sobrescrita pela busca automática
async function saveManual(supabase, episodeId, input) {
  const values = sanitize(input);
  const given = ['intro_start', 'intro_end', 'credits_start'].filter(k => num(input[k]) !== null);
  const rejected = given.filter(k => values[k] === null);
  if (rejected.length) {
    throw Object.assign(new Error('Tempos inválidos. A abertura precisa durar de 5 segundos a 6 minutos, e os créditos começam depois dela.'), { status: 400 });
  }
  const ok = await store(supabase, episodeId, { ...values, source: 'manual', manual: true, checked_at: Date.now() });
  if (!ok) { memory.delete(episodeId); throw Object.assign(new Error('Não salvou. Rode a migração 20261129_skip_times no Supabase.'), { status: 500 }); }
  return { ...values, source: 'manual' };
}

// Volta pro automático
async function clearStored(supabase, episodeId) {
  memory.delete(episodeId);
  const { error } = await supabase.from('episode_skip_times').delete().eq('episode_id', episodeId);
  if (error) throw error;
}

const _reset = () => { memory.clear(); imdbIds.clear(); pending.clear(); recent = []; blockedUntil = 0; };

module.exports = { getSkipTimes, saveManual, clearStored, sanitize, _reset };
