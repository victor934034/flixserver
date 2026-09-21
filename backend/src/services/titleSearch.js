const { supabase } = require('./supabase');

// Busca por titulo tolerante a acento, hifen e pontuacao:
// "homem aranha" acha "Homem-Aranha", "hercules" acha "Hércules",
// "spider man" acha "Spider-Man". O ilike do Postgres nao faz isso (sem
// extensao unaccent), entao a comparacao e feita aqui em Node, contra um
// cache leve (id + titulos normalizados) recarregado a cada 60s.

const TTL_MS = 60_000;
const TABLES = {
  movies:   { cols: 'id, title, original_title, views', filter: q => q.eq('is_active', true) },
  series:   { cols: 'id, title, original_title, views', filter: q => q.eq('is_active', true) },
  episodes: { cols: 'id, title',                         filter: q => q },
};
const cache = {}; // table -> { at, rows, loading }

function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // tira acentos
    .replace(/[^a-z0-9]+/g, ' ')                       // hifen, ponto, dois-pontos etc viram espaco
    .trim();
}

async function loadTable(table) {
  const { cols, filter } = TABLES[table];
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(supabase.from(table).select(cols)).range(from, from + 999);
    if (error) throw error;
    for (const r of data || []) {
      rows.push({
        id: r.id,
        views: r.views || 0,
        t: normalizeTitle(r.title),
        o: normalizeTitle(r.original_title),
      });
    }
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function getRows(table) {
  const c = cache[table];
  if (c && Date.now() - c.at < TTL_MS) return c.rows;
  if (c && c.loading) return c.loading; // evita carregar 2x em paralelo
  const loading = loadTable(table).then(rows => {
    cache[table] = { at: Date.now(), rows };
    return rows;
  }).catch(err => {
    delete (cache[table] || {}).loading;
    if (c) return c.rows; // serve cache velho se o reload falhar
    throw err;
  });
  cache[table] = { ...(c || { at: 0, rows: [] }), loading };
  return loading;
}

// Devolve ids ordenados por relevancia: titulo comeca com a busca > palavra
// comeca com a busca > contem; empate desempata por views.
async function searchIds(table, rawQuery, limit = 20) {
  const q = normalizeTitle(rawQuery);
  if (!q) return [];
  const tokens = q.split(' ');
  const rows = await getRows(table);
  const scored = [];
  for (const r of rows) {
    const hay = r.t + (r.o && r.o !== r.t ? ' ' + r.o : '');
    if (!tokens.every(tok => hay.includes(tok))) continue;
    let score = 1;
    if (r.t === q) score = 4;
    else if (r.t.startsWith(q) || r.o.startsWith(q)) score = 3;
    else if ((' ' + r.t).includes(' ' + tokens[0])) score = 2;
    scored.push({ id: r.id, score, views: r.views });
  }
  scored.sort((a, b) => b.score - a.score || b.views - a.views);
  return scored.slice(0, limit).map(s => s.id);
}

// Reordena as linhas vindas do banco (.in('id', ids)) na ordem de relevancia.
function orderByIds(rows, ids) {
  const pos = new Map(ids.map((id, i) => [id, i]));
  return [...rows].sort((a, b) => pos.get(a.id) - pos.get(b.id));
}

module.exports = { normalizeTitle, searchIds, orderByIds };
