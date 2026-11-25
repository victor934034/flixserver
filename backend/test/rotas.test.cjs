// Testes do servidor com um Supabase em memória: não tocam no banco de verdade.
// Rodar antes de publicar:  npm test
const path = require('path'), Module = require('module'), assert = require('assert');
const BE = path.resolve(__dirname, '..').split(path.sep).join('/');
const req = Module.createRequire(path.join(BE, 'package.json'));
const db = {};
let seq = 0;
function from(table) {
  const f = []; let op = 'select', payload, opts = {}, rng, lim, one;
  const rows = () => (db[table] ||= []);
  const q = {
    select(c, o) { if (op === 'select') opts = o || {}; return q; },
    update(p) { op = 'update'; payload = p; return q; },
    upsert(p, o) { op = 'upsert'; payload = p; opts = { ...opts, key: o?.onConflict }; return q; }, insert(p) { op = 'insert'; payload = p; return q; },
    delete() { op = 'delete'; return q; },
    eq(k, v) { f.push(r => r[k] === v); return q; }, neq(k, v) { f.push(r => r[k] !== v); return q; },
    in(k, v) { f.push(r => v.includes(r[k])); return q; }, is(k, v) { f.push(r => (r[k] ?? null) === v); return q; },
    gte(k, v) { f.push(r => r[k] >= v); return q; }, gt(k, v) { f.push(r => r[k] > v); return q; },
    not(k, o, v) {
      if (o === 'is') f.push(r => (r[k] ?? null) !== v);
      else if (o === 'in') { const l = v.slice(1, -1).split(','); f.push(r => !l.includes(r[k])); }
      return q;
    },
    contains(k, v) { f.push(r => v.every(x => (r[k] || []).includes(x))); return q; },
    or(s) {
      const parts = s.split(',').map(p => p.split('.'));
      f.push(r => parts.some(p => p[1] === 'not' ? r[p[0]] != null : p[2] === 'null' ? r[p[0]] == null : String(r[p[0]]) === p[2]));
      return q;
    },
    order() { return q; }, range(a, b) { rng = [a, b]; return q; }, limit(n) { lim = n; return q; },
    single() { one = 'single'; return q; }, maybeSingle() { one = 'maybe'; return q; },
    then(res, rej) {
      let out = rows().filter(r => f.every(fn => fn(r)));
      if (op === 'update') out.forEach(r => Object.assign(r, payload));
      if (op === 'delete') db[table] = rows().filter(r => !out.includes(r));
      if (op === 'upsert') {
        const found = rows().find(r => r[opts.key] === payload[opts.key]);
        if (found) Object.assign(found, payload); else rows().push({ ...payload });
        out = [payload];
      }
      if (op === 'insert') { out = [].concat(payload).map(p => ({ id: 'n' + ++seq, ...p })); rows().push(...out); }
      const count = out.length;
      if (rng) out = out.slice(rng[0], rng[1] + 1);
      if (lim) out = out.slice(0, lim);
      let data = out.map(r => ({ ...r }));
      if (one) data = data[0] || null;
      const error = one === 'single' && !data ? { message: 'not found' } : null;
      return Promise.resolve({ data: opts.head ? null : data, count, error }).then(res, rej);
    },
  };
  return q;
}
const supabase = { from, rpc: async () => ({}) };
const fetchAll = async mk => mk();
const stub = (rel, exports) => { const p = path.resolve(BE, rel); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };
const pushes = [];
stub('src/services/supabase.js', { supabase, supabaseAnon: supabase, fetchAll });
stub('src/services/notifications.js', { sendPush: async (t, title, body) => pushes.push([t[0], title, body]) });
stub('src/services/titleSearch.js', { searchIds: async () => [], orderByIds: x => x });

process.env.JWT_SECRET = 'x'.repeat(40); process.env.FRONTEND_URL = 'https://exemplo.test';
const express = req('express'), jwt = req('jsonwebtoken');
const app = express(); app.use(express.json());
for (const name of ['movies', 'recommendations', 'history', 'referrals', 'suggestions', 'watched', 'episodes']) app.use('/api/' + name, require(`${BE}/src/routes/${name}.js`));
const { rewardReferrer } = require(`${BE}/src/services/referrals.js`);
const alerts = require(`${BE}/src/services/suggestionAlerts.js`);
const now = new Date().toISOString(), old = '2020-01-01T00:00:00.000Z';
const U = i => `00000000-0000-0000-0000-00000000000${i}`;

(async () => {
  const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}/api`;
  const call = async (method, url, user, body) => {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Authorization = 'Bearer ' + jwt.sign({ id: user }, process.env.JWT_SECRET);
    const r = await fetch(base + url, { method, headers, body: body && JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  // Surpreenda-me
  db.movies = [
    { id: U(1), title: 'A', is_active: true, genres: ['Drama'], file_dubbing: 'a', tmdb_id: 10, created_at: now },
    { id: U(2), title: 'B', is_active: true, genres: ['Terror'], file_dubbing: 'b', created_at: old },
    { id: U(3), title: 'sem video', is_active: true, genres: ['Drama'], created_at: now },
  ];
  for (let i = 0; i < 20; i++) assert.equal((await call('GET', '/movies/surprise?genre=Drama')).body.id, U(1));
  assert.equal((await call('GET', `/movies/surprise?exclude=${U(1)}`)).body.id, U(2));
  assert.equal((await call('GET', `/movies/surprise?genre=Drama&exclude=${U(1)}`)).status, 404);
  console.log('ok surpreenda-me: gênero, sem repetir, ignora filme sem vídeo');

  // Top 10
  db.series = [{ id: U(5), title: 'Serie', is_active: true, tmdb_id: 20, created_at: now }];
  const h = (user, type, id, extra = {}) => ({ id: 'h' + ++seq, user_id: user, content_type: type, content_id: id, series_id: type === 'episode' ? U(5) : null, progress: 500, completed: false, last_watched: now, profile_id: null, ...extra });
  db.watch_history = [h(U(1), 'movie', U(2)), h(U(1), 'episode', 'e1'), h(U(1), 'episode', 'e2'), h(U(2), 'episode', 'e1'), h(U(3), 'movie', U(1), { progress: 5 }), h(U(4), 'movie', U(1), { last_watched: old })];
  const top = (await call('GET', '/recommendations/top10', U(1))).body;
  assert.deepEqual(top.map(t => [t.rank, t.title]), [[1, 'Serie'], [2, 'B']]);
  console.log('ok top 10: conta contas diferentes, ignora menos de 60s e fora da semana');

  // Tirar do Continuar assistindo
  db.watch_history = [
    h(U(1), 'episode', 'e1', { completed: true }), h(U(1), 'episode', 'e2'), h(U(1), 'episode', 'e3', { completed: null }),
    h(U(2), 'episode', 'e2'), h(U(1), 'episode', 'e2', { profile_id: 'p2' }), h(U(1), 'movie', U(2)),
  ];
  db.episodes = ['e1', 'e2', 'e3'].map(id => ({ id, series_id: U(5), is_active: true, file_dubbing: 'x' }));
  const target = db.watch_history[1].id;
  assert.equal((await call('DELETE', `/history/${target}`, U(2))).status, 404);
  assert.equal((await call('DELETE', `/history/${target}`, U(1))).status, 200);
  assert.deepEqual(db.watch_history.map(r => `${r.user_id.slice(-1)}:${r.content_id.slice(-2)}:${r.profile_id}`),
    ['1:e1:null', '2:e2:null', '1:e2:p2', '1:02:null']);
  console.log('ok remover: só os pela metade da série, do próprio usuário e perfil');

  // Pedido atendido
  db.users = [{ id: U(1), push_token: 'ExponentPushToken[a]', created_at: now }];
  const sg = (id, extra) => ({ id, user_id: U(1), title: 'p', type: 'movie', tmdb_id: 10, status: 'pending', created_at: old, ...extra });
  db.suggestions = [sg('s1'), sg('s2', { type: 'series', tmdb_id: 20 }), sg('s3', { created_at: '2999-01-01T00:00:00.000Z' }), sg('s4', { tmdb_id: 999 })];
  assert.equal(await alerts.checkFulfilledSuggestions(supabase), 2);
  assert.equal(await alerts.checkFulfilledSuggestions(supabase), 0);
  assert.equal(pushes.length, 2);
  assert.deepEqual(db.suggestions.map(s => s.status), ['added', 'added', 'pending', 'pending']);
  console.log('ok pedido atendido: avisa uma vez; ignora o que já existia antes do pedido');

  db.suggestions.forEach(x => { if (x.status === 'added') x.updated_at = now; });
  db.movies[0].created_at = now;
  const arrived2 = (await call('GET', '/suggestions/arrived', U(1))).body;
  assert.deepEqual(arrived2.map(a => [a.content_type, a.content_id]), [['movie', U(1)], ['series', U(5)]]);
  assert.deepEqual((await call('GET', '/suggestions/arrived', U(2))).body, []);
  console.log('ok aviso dentro do app: só os pedidos do próprio usuário');

  // Indique um amigo
  db.system_settings = [{ key: 'referral_enabled', value: 'false' }, { key: 'referral_days', value: '7' }];
  assert.deepEqual((await call('GET', '/referrals/me', U(1))).body, { enabled: false });
  db.system_settings[0].value = 'true';
  db.users = [
    { id: U(1), created_at: old, plan: null, plan_expires_at: null, referral_code: null, push_token: 'ExponentPushToken[a]' },
    { id: U(2), created_at: now }, { id: U(3), created_at: old },
  ];
  db.referrals = []; db.payments = []; db.trial_claims = [];
  const me = (await call('GET', '/referrals/me', U(1))).body;
  assert.match(me.code, /^[A-Z2-9]{7}$/); assert.equal(me.link, `https://exemplo.test/indicar?codigo=${me.code}`);
  assert.equal((await call('POST', '/referrals/apply', U(1), { code: me.code })).status, 400);
  assert.equal((await call('POST', '/referrals/apply', U(3), { code: me.code })).status, 400);
  assert.equal((await call('POST', '/referrals/apply', U(2), { code: 'ZZZZZZZ' })).status, 404);
  assert.equal((await call('POST', '/referrals/apply', U(2), { code: me.code.toLowerCase() })).status, 200);
  assert.equal((await call('POST', '/referrals/apply', U(2), { code: me.code })).status, 400);
  const plans = async () => [{ id: 'caro', price: 30, active: true }, { id: 'barato', price: 10, active: true }];
  pushes.length = 0;
  const results = await Promise.all([rewardReferrer(supabase, U(2), plans), rewardReferrer(supabase, U(2), plans)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await rewardReferrer(supabase, U(2), plans), false);
  const days = (new Date(db.users[0].plan_expires_at) - Date.now()) / 86400000;
  assert.equal(db.users[0].plan, 'barato'); assert.ok(days > 6.9 && days <= 7); assert.equal(pushes.length, 1);
  console.log('ok indicação: desligada por padrão, regras de uso e prêmio uma única vez');
  // Marcar como já assistido
  const S = U(5);
  db.watched_marks = [];
  db.episodes = ['e1', 'e2'].map(id => ({ id, series_id: S }));
  db.watch_history = [h(U(1), 'episode', 'e1'), h(U(1), 'episode', 'e2', { completed: true }), h(U(2), 'episode', 'e1')];
  assert.equal((await call('PUT', '/watched', U(1), { content_type: 'x', content_id: S, watched: true })).status, 400);
  assert.equal((await call('PUT', '/watched', U(1), { content_type: 'series', content_id: S, watched: true })).status, 200);
  assert.equal(db.watched_marks.length, 1);
  assert.deepEqual(db.watch_history.map(r => `${r.user_id.slice(-1)}:${r.content_id}`), ['1:e2', '2:e1']);
  assert.deepEqual((await call('GET', '/watched', U(1))).body, { enabled: true, items: [{ content_type: 'series', content_id: S }] });
  assert.deepEqual((await call('GET', '/watched', U(2))).body.items, []);
  await call('PUT', '/watched', U(1), { content_type: 'series', content_id: S, watched: false });
  assert.equal(db.watched_marks.length, 0);
  console.log('ok já assistido: marca, desmarca e tira do Continuar só do próprio usuário');

  // Painel do que as pessoas assistem
  const { buildInsights } = require(`${BE}/src/services/insights.js`);
  const past = new Date(Date.now() - 5 * 86400000).toISOString();
  const low = { progress: 100, duration: 6000, last_watched: past };
  db.watch_history = [
    h(U(1), 'movie', U(1), low), h(U(2), 'movie', U(1), low),
    h(U(1), 'movie', U(2), { progress: 5000, duration: 6000, completed: true, last_watched: past }),
    h(U(3), 'episode', 'e1', low), h(U(3), 'episode', 'e2', { progress: 1200, duration: 1300, completed: true, last_watched: past }),
  ];
  db.suggestions = [sg('a', {}), sg('b', { user_id: U(2) }), sg('c', { user_id: U(2) }), sg('d', { tmdb_id: 7, status: 'added' })];
  const ins = await buildInsights(supabase, 30);
  assert.equal(ins.active_accounts, 3);
  assert.deepEqual(ins.abandoned.map(a => [a.title, a.accounts, a.watched_by]), [['A', 2, 2]]);
  assert.deepEqual(ins.requests.map(r => r.accounts), [2]);
  assert.deepEqual(ins.most_watched.map(m => m.accounts), [2, 1, 1]);
  console.log('ok painel: mais vistos, abandonados (sem contar quem seguiu a série) e pedidos');

  // Abertura e créditos (o IntroDB e o TMDB são simulados: o teste não sai pra internet)
  const axios = req('axios');
  const realGet = axios.get;
  let introCalls = 0, introReply;
  axios.get = async (url, cfg) => {
    if (url.includes('external_ids')) return { data: { imdb_id: 'tt0000001' } };
    introCalls++;
    assert.deepEqual(cfg.params, { imdb_id: 'tt0000001', season: 1, episode: 2 });
    if (introReply instanceof Error) throw introReply;
    return { data: introReply };
  };
  const skip = require(`${BE}/src/services/skipTimes.js`);
  const E = U(7);
  db.episodes = [{ id: E, series_id: U(5), season_number: 1, episode_number: 2 }];
  db.series = [{ id: U(5), tmdb_id: 20 }];
  db.episode_skip_times = [];
  db.users = [{ id: U(1), is_admin: true }, { id: U(2), is_admin: false }];
  const url = `/episodes/${E}/skip-times`;
  assert.equal((await call('GET', url)).status, 401);

  introReply = Object.assign(new Error('rede'), { response: { status: 500 } });
  assert.equal((await call('GET', url, U(2))).body.intro_end, null);
  assert.equal(db.episode_skip_times.length, 0); // falha não vira "não tem"

  introReply = { intro: { start_sec: 314.5, end_sec: 331 }, outro: { start_sec: 2843 } };
  const first = (await call('GET', url, U(2))).body;
  assert.deepEqual(first, { intro_start: 314.5, intro_end: 331, credits_start: 2843, source: 'introdb' });
  const callsAfterFirst = introCalls;
  await Promise.all([call('GET', url, U(2)), call('GET', url, U(1))]);
  assert.equal(introCalls, callsAfterFirst); // veio do que já estava guardado

  assert.equal((await call('PUT', url, U(2), { intro_start: 1, intro_end: 60 })).status, 403);
  assert.equal((await call('PUT', url, U(1), { intro_start: 100, intro_end: 101 })).status, 400);
  assert.equal((await call('PUT', url, U(1), { intro_start: 10, intro_end: 70, credits_start: 1200 })).status, 200);
  db.episode_skip_times[0].checked_at = '2020-01-01T00:00:00.000Z';
  assert.equal((await call('GET', url, U(2))).body.source, 'manual'); // correção nunca é sobrescrita
  assert.equal((await call('DELETE', url, U(1))).status, 200);
  assert.equal((await call('GET', url, U(2))).body.source, 'introdb');

  assert.deepEqual(skip.sanitize({ intro_start: null, intro_end: 23.7, credits_start: 1311 }), { intro_start: 0, intro_end: 23.7, credits_start: 1311 });
  assert.deepEqual(skip.sanitize({ intro_start: 0, intro_end: 900, credits_start: 0 }), { intro_start: null, intro_end: null, credits_start: null });

  skip._reset(); db.episode_skip_times = [];
  introReply = Object.assign(new Error('devagar'), { response: { status: 429 } });
  await call('GET', url, U(2));
  const callsAtBlock = introCalls;
  await call('GET', url, U(2));
  assert.equal(introCalls, callsAtBlock); // respeita o "pare" do IntroDB
  axios.get = realGet;
  console.log('ok abertura: guarda o resultado, respeita correção manual, limite e falhas');

  srv.close(); console.log('TODOS OS TESTES PASSARAM');
})().catch(e => { console.error(e); process.exit(1); });
