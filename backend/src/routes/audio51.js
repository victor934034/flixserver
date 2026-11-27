// Painel "Áudio com defeito" (montado em /api/admin/audio-51, já protegido como admin).
// Procura e conserta, um arquivo por vez, as faixas AAC fora do padrão.
const router = require('express').Router();
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('ffprobe-static').path;
const { supabase, fetchAll } = require('../services/supabase');
const { probe, convert } = require('../services/aacRepair');
const { inspect } = require('../services/mediaInspect');
const { takeTurn, busyWith, downloadFile, cleanLeftovers } = require('../services/mediaWork');
const { replaceMediaUrl } = require('../services/mediaLinks');

// "private" no nome: a rota pública /settings não expõe esta chave
const KEY = 'private_audio_repair';
// A Backblaze bloqueia a conta inteira com muitos pedidos: um arquivo de cada vez
// (o intervalo entre os pedidos fica no mediaInspect)
const PAUSE_MS = 300;
const RATE_WAIT_MS = 90_000;
const FIELDS = {
  movies: ['file_dubbing', 'file_subtitled', 'file_cinema', 'file_4k', 'file_color', 'file_bw'],
  episodes: ['file_dubbing', 'file_subtitled', 'file_cinema', 'file_color', 'file_bw'],
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
// seen: arquivos já conferidos, para uma nova busca olhar só o que é novo
let report = null; // { cursor, total, finished, unreadable, found: [], seen: [] }
let activity = null; // null | 'scan' | 'fix'
let message = '';
let current = '';
let stopRequested = false;
const queue = [];

async function loadReport() {
  if (report) return report;
  const { data } = await supabase.from('system_settings').select('value').eq('key', KEY).maybeSingle();
  try { report = data?.value ? JSON.parse(data.value) : null; } catch { report = null; }
  report = report || { cursor: 0, total: 0, finished: false, unreadable: 0, found: [] };
  report.seen = report.seen || [];
  cleanLeftovers();
  return report;
}

async function saveReport() {
  const { error } = await supabase.from('system_settings')
    .upsert({ key: KEY, value: JSON.stringify(report), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) console.error('[audio-51] não salvou:', error.message);
}

// Filmes primeiro, depois episódios; cada arquivo uma vez só
async function listFiles() {
  const out = new Map();
  for (const table of ['movies', 'episodes']) {
    const select = table === 'movies'
      ? `id, title, ${FIELDS.movies.join(', ')}`
      : `id, season_number, episode_number, series:series_id(title), ${FIELDS.episodes.join(', ')}`;
    const { data, error } = await fetchAll(() => supabase.from(table).select(select).order('id'));
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const row of data || []) {
      const title = table === 'movies' ? row.title : `${row.series?.title || 'Série'} T${row.season_number}E${row.episode_number}`;
      for (const field of FIELDS[table]) {
        const url = row[field];
        if (url && /\.(mp4|m4v)$/i.test(url.split('?')[0]) && !out.has(url)) out.set(url, { url, title });
      }
    }
  }
  return [...out.values()];
}

const idOf = url => crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);

async function scan() {
  const files = await listFiles();
  const seen = new Set(report.seen);
  const pending = files.filter(f => !seen.has(idOf(f.url)));
  report.total = files.length;
  report.cursor = files.length - pending.length;
  report.finished = false;
  report.unreadable = 0;
  let limited = 0;
  let sinceSave = 0;
  for (let n = 0; n < pending.length && !stopRequested; n++) {
    const file = pending[n];
    current = file.title;
    try {
      const info = await inspect(file.url, ffprobePath);
      limited = 0;
      message = '';
      if (info.audio.some(t => t.broken) && !report.found.some(f => f.url === file.url)) {
        report.found.push({
          url: file.url, title: file.title, status: 'broken',
          tracks: info.audio.map(t => ({ language: t.language, channels: t.channels, broken: t.broken })),
        });
      }
      report.seen.push(idOf(file.url));
    } catch (e) {
      if (e.status === 429 || /429|too many requests/i.test(e.message)) {
        limited += 1;
        if (limited > 5) { message = 'A Backblaze limitou os pedidos. A busca parou; continue mais tarde.'; break; }
        message = 'A Backblaze pediu para esperar. Continuando em instantes...';
        await sleep(RATE_WAIT_MS * limited);
        n -= 1; // tenta o mesmo arquivo de novo
        continue;
      }
      // não entra em "seen": a próxima busca tenta de novo
      report.unreadable += 1;
      console.warn('[audio-51] não leu', file.title, e.message.slice(0, 150));
    }
    report.cursor += 1;
    if (++sinceSave >= 25) { sinceSave = 0; await saveReport(); }
    await sleep(PAUSE_MS);
  }
  report.finished = !stopRequested && report.cursor >= files.length;
}

// O arquivo novo ganha outro nome (o cache do CDN guardaria o antigo) e o antigo NÃO é apagado
async function fixOne(item) {
  const { uploadFileFromPath } = require('../services/backblaze');
  const cdn = process.env.CDN_BASE_URL || '';
  if (!cdn || !item.url.startsWith(cdn + '/')) throw new Error('Endereço fora do CDN configurado');
  const name = decodeURIComponent(new URL(item.url).pathname.replace(/^\//, ''));
  const newName = name.replace(/\.(mp4|m4v)$/i, '') + '.aac-ok.mp4';
  const stamp = Date.now();
  const input = path.join(os.tmpdir(), `aac_in_${stamp}.mp4`);
  const output = path.join(os.tmpdir(), `aac_out_${stamp}.mp4`);
  try {
    item.step = 'baixando';
    await downloadFile(item.url, input);
    item.step = 'convertendo o áudio';
    const result = await convert({ ffmpegPath, ffprobePath }, input, output);
    if (!result.changed) { item.status = 'ok'; return; }
    fs.unlinkSync(input); // libera espaço antes de enviar
    item.step = 'enviando';
    const { cdnUrl } = await uploadFileFromPath(output, newName, 'video/mp4');
    item.step = 'conferindo o arquivo enviado';
    const online = await inspect(cdnUrl, ffprobePath);
    if (online.audio.some(t => t.broken) || online.audio.length !== result.after.audio.length) {
      throw new Error('O arquivo enviado não passou na conferência');
    }
    await replaceMediaUrl(supabase, item.url, cdnUrl);
    item.status = 'fixed';
    item.newUrl = cdnUrl;
  } finally {
    for (const f of [input, output]) { try { fs.unlinkSync(f); } catch {} }
    delete item.step;
  }
}

async function work() {
  while (queue.length && !stopRequested) {
    const url = queue.shift();
    const item = report.found.find(f => f.url === url);
    if (!item || item.status === 'fixed') continue;
    current = item.title;
    item.status = 'converting';
    delete item.error;
    try {
      await fixOne(item);
      console.log('[audio-51] consertado:', item.title, item.newUrl || '(já estava bom)');
    } catch (e) {
      item.status = 'error';
      item.error = e.message.slice(0, 200);
      console.error('[audio-51]', item.title, e.message);
    }
    await saveReport();
    await sleep(PAUSE_MS);
  }
  // o que ficou na fila volta a aparecer como pendente
  queue.length = 0;
  report.found.forEach(f => { if (f.status === 'queued') f.status = 'broken'; });
}

function start(kind, task, done) {
  activity = kind;
  stopRequested = false;
  message = '';
  task()
    .catch(e => { message = 'Erro: ' + e.message; console.error('[audio-51]', e.message); })
    .finally(async () => { activity = null; current = ''; done(); await saveReport(); });
}
const BUSY = 'Outro conserto de vídeo está rodando no servidor. Espere ele terminar.';

router.get('/status', async (req, res) => {
  try {
    await loadReport();
    // um conserto interrompido por reinício do servidor volta a pendente
    if (!activity) report.found.forEach(f => { if (f.status === 'converting' || f.status === 'queued') f.status = 'broken'; });
    const { seen, ...visible } = report; // a lista interna não precisa ir para a tela
    res.json({ activity, current, message, ...visible });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/scan', async (req, res) => {
  if (activity) return res.status(409).json({ error: 'Já há uma tarefa em andamento.' });
  await loadReport();
  const done = takeTurn('audio-51');
  if (!done) return res.status(409).json({ error: BUSY });
  if (req.body?.restart) {
    // "conferir tudo de novo": mantém o histórico dos que já foram consertados
    report = { cursor: 0, total: 0, finished: false, unreadable: 0, seen: [], found: report.found.filter(f => f.status === 'fixed') };
  }
  start('scan', scan, done);
  res.json({ ok: true });
});

router.post('/fix', async (req, res) => {
  const urls = Array.isArray(req.body?.urls) ? req.body.urls : [];
  await loadReport();
  if (activity === 'scan') return res.status(409).json({ error: 'Pare a busca antes de converter.' });
  const items = report.found.filter(f => urls.includes(f.url) && (f.status === 'broken' || f.status === 'error'));
  if (!items.length) return res.status(400).json({ error: 'Nada para converter.' });
  // já convertendo: só entra na fila
  const done = activity ? null : takeTurn('audio-51');
  if (!activity && !done) return res.status(409).json({ error: BUSY });
  items.forEach(f => { f.status = 'queued'; queue.push(f.url); });
  if (done) start('fix', work, done);
  res.json({ ok: true, queued: items.length });
});

// Termina o arquivo atual e para
router.post('/stop', (req, res) => {
  stopRequested = true;
  res.json({ ok: true });
});

module.exports = router;
