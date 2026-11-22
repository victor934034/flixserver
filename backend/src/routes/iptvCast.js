// Proxy HLS para transmitir canais de IPTV ao Chromecast.
// O receiver do Chromecast busca o vídeo sozinho (do celular só vai o endereço) e exige
// CORS + HTTPS, que os servidores do IPTV não oferecem. Este proxy devolve a lista .m3u8
// com os trechos apontando pra cá e repassa cada trecho com os cabeçalhos corretos.
//
//  GET /api/iptv/cast/:streamId.m3u8?t=<token>   lista do canal (token vem de /api/iptv/cast-url)
//  GET /api/iptv/cast/seg?u=&e=&s=               trecho/lista interna assinada pela própria lista
const router = require('express').Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { supabase } = require('../services/supabase');

const TTL_SEC = 12 * 3600;
const UA = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const secret = () => process.env.JWT_SECRET;
const servers = () => (process.env.IPTV_SERVER_URL || '').split(',').map(u => u.trim().replace(/\/$/, '')).filter(Boolean);

const b64 = s => Buffer.from(s).toString('base64url');
const unb64 = s => Buffer.from(s, 'base64url').toString();
const sign = (u, e) => crypto.createHmac('sha256', secret()).update(`${u}|${e}`).digest('hex').slice(0, 32);
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function baseUrl(req) {
  const proto = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  return `${proto}://${req.get('host')}`;
}

// Endereço que o celular entrega ao Chromecast
function castUrlFor(req, userId, streamId) {
  const t = jwt.sign({ k: 'cast', u: userId, s: String(streamId) }, secret(), { expiresIn: TTL_SEC });
  return `${baseUrl(req)}/api/iptv/cast/${encodeURIComponent(streamId)}.m3u8?t=${t}`;
}

function proxied(req, abs, exp) {
  const u = b64(abs);
  return `${baseUrl(req)}/api/iptv/cast/seg?u=${u}&e=${exp}&s=${sign(u, exp)}`;
}

// Reescreve toda referência da lista (linhas de trecho e atributos URI="...") para o proxy
function rewritePlaylist(req, text, from, exp) {
  const resolve = ref => { try { return new URL(ref, from).toString(); } catch { return null; } };
  return text.split(/\r?\n/).map(line => {
    const l = line.trim();
    if (!l) return line;
    if (l.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (m, ref) => { const abs = resolve(ref); return abs ? `URI="${proxied(req, abs, exp)}"` : m; });
    }
    const abs = resolve(l);
    return abs ? proxied(req, abs, exp) : line;
  }).join('\n');
}

const get = (url, stream) => axios.get(url, {
  responseType: stream ? 'stream' : 'text',
  transformResponse: stream ? undefined : (r => r),
  timeout: 15000, maxRedirects: 5, headers: { 'User-Agent': UA },
  validateStatus: s => s < 400,
});
const finalUrl = (r, fallback) => (r.request && r.request.res && r.request.res.responseUrl) || fallback;

function sendPlaylist(req, res, text, from) {
  if (!String(text).trim().startsWith('#EXTM3U')) return res.status(502).send('Playlist inválida');
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  res.set({ 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' });
  return res.send(rewritePlaylist(req, text, from, exp));
}

router.get('/:streamId.m3u8', async (req, res) => {
  let t;
  try { t = jwt.verify(String(req.query.t || ''), secret()); } catch { return res.sendStatus(403); }
  if (t.k !== 'cast' || t.s !== String(req.params.streamId)) return res.sendStatus(403);
  try {
    const { data: cred } = await supabase.from('iptv_credentials').select('xc_username, xc_password, active').eq('user_id', t.u).single();
    if (!cred || !cred.active) return res.sendStatus(403);
    let lastErr;
    for (const server of servers()) {
      const up = `${server}/live/${encodeURIComponent(cred.xc_username)}/${encodeURIComponent(cred.xc_password)}/${encodeURIComponent(req.params.streamId)}.m3u8`;
      try {
        const r = await get(up, false);
        return sendPlaylist(req, res, r.data, finalUrl(r, up));
      } catch (e) { lastErr = e; }
    }
    console.error('[iptv-cast] playlist falhou:', lastErr && lastErr.message);
    res.sendStatus(502);
  } catch (e) {
    console.error('[iptv-cast] erro:', e.message);
    res.sendStatus(500);
  }
});

router.get('/seg', async (req, res) => {
  const { u, e, s } = req.query;
  if (!u || !e || !s || Number(e) < Date.now() / 1000 || !safeEq(sign(String(u), String(e)), s)) return res.sendStatus(403);
  const url = unb64(String(u));
  try {
    const r = await get(url, true);
    const ct = String(r.headers['content-type'] || '');
    if (/mpegurl/i.test(ct) || /\.m3u8(\?|$)/i.test(url)) {
      const chunks = [];
      for await (const c of r.data) chunks.push(c);
      return sendPlaylist(req, res, Buffer.concat(chunks).toString('utf8'), finalUrl(r, url));
    }
    res.set({ 'Content-Type': ct || 'video/mp2t', 'Cache-Control': 'no-store' });
    if (r.headers['content-length']) res.set('Content-Length', r.headers['content-length']);
    req.on('close', () => { try { r.data.destroy(); } catch {} });
    r.data.on('error', () => { try { res.end(); } catch {} });
    r.data.pipe(res);
  } catch (err) {
    res.sendStatus(502);
  }
});

module.exports = { router, castUrlFor, rewritePlaylist, sign };
