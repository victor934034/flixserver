// Identificação do cliente (IP + dispositivo), bloqueios e detecção de VPN.
//
// IMEI: apps comuns NÃO conseguem ler o IMEI (Android 10+ e iOS bloqueiam).
// Usamos o ID do aparelho (Android ID / identificador da instalação) enviado em
// X-Device-Id, e guardamos só o hash SHA-256 dele.
const crypto = require('crypto');
const axios = require('axios');
const { supabase } = require('./supabase');

const DEVICE_RE = /^[A-Za-z0-9._:\-]{8,128}$/;

function clientIp(req) {
  // Só confia em CF-Connecting-IP se o site estiver mesmo atrás da Cloudflare.
  if (process.env.TRUST_CLOUDFLARE === 'true' && req.headers['cf-connecting-ip']) {
    return String(req.headers['cf-connecting-ip']).trim();
  }
  return String(req.ip || '').replace(/^::ffff:/, '');
}

function platformOf(req) {
  const p = String(req.headers['x-platform'] || 'web').toLowerCase();
  return ['android', 'ios', 'tv', 'web'].includes(p) ? p : 'web';
}

function deviceHash(req) {
  const raw = String(req.headers['x-device-id'] || '');
  if (!DEVICE_RE.test(raw)) return null;
  return crypto.createHash('sha256').update(`${process.env.JWT_SECRET}|${raw}`).digest('hex');
}

// ── CIDR IPv4 ──
function ipv4ToInt(ip) {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  if (!m) return null;
  return ((+m[1] << 24) | (+m[2] << 16) | (+m[3] << 8) | +m[4]) >>> 0;
}
function ipMatches(ip, rule) {
  if (rule === ip) return true;
  const [base, bits] = rule.split('/');
  if (!bits) return false;
  const a = ipv4ToInt(ip), b = ipv4ToInt(base), n = parseInt(bits, 10);
  if (a === null || b === null || !(n >= 0 && n <= 32)) return false;
  const mask = n === 0 ? 0 : (~0 << (32 - n)) >>> 0;
  return ((a & mask) >>> 0) === ((b & mask) >>> 0);
}

// ── Cache da blocklist (60s) ──
let cache = { at: 0, rows: [] };
async function loadBlocklist() {
  if (Date.now() - cache.at < 60000) return cache.rows;
  const { data } = await supabase.from('blocked_entries').select('kind, value, scope');
  cache = { at: Date.now(), rows: data || [] };
  return cache.rows;
}
function invalidateBlocklist() { cache.at = 0; }

async function isBlocked(req, scope = 'all') {
  const rows = await loadBlocklist();
  const ip = clientIp(req);
  const dev = deviceHash(req);
  return rows.some(r =>
    (r.scope === 'all' || r.scope === scope) &&
    ((r.kind === 'ip' && ipMatches(ip, r.value)) || (r.kind === 'device' && dev && r.value === dev)));
}

// Middleware global: bloqueios com escopo "all"
function blocklistMiddleware(req, res, next) {
  isBlocked(req, 'all')
    .then(blocked => (blocked ? res.status(403).json({ error: 'Acesso negado.', code: 'blocked' }) : next()))
    .catch(() => next()); // falha de banco não derruba o site
}

// ── Detecção de VPN / proxy / Tor (proxycheck.io) ──
// Sem chave: 100 consultas/dia. Com PROXYCHECK_KEY (grátis em proxycheck.io): 1000/dia.
const vpnCache = new Map(); // ip -> { at, bad }
const PRIVATE = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fe80:|fc|fd)/i;

async function isVpn(ip) {
  if (!ip || PRIVATE.test(ip)) return false;
  const hit = vpnCache.get(ip);
  if (hit && Date.now() - hit.at < 6 * 3600 * 1000) return hit.bad;
  try {
    const { data } = await axios.get(`https://proxycheck.io/v2/${encodeURIComponent(ip)}`, {
      params: { vpn: 1, key: process.env.PROXYCHECK_KEY || undefined },
      timeout: 3500,
    });
    const info = data && data[ip];
    if (!info) throw new Error(data?.message || 'resposta inesperada');
    const bad = info.proxy === 'yes';
    vpnCache.set(ip, { at: Date.now(), bad });
    return bad;
  } catch (e) {
    console.warn('[guard] consulta de VPN falhou (liberando):', e.message);
    return false; // fail-open: serviço fora do ar não pode bloquear todo mundo
  }
}

module.exports = { clientIp, platformOf, deviceHash, isBlocked, blocklistMiddleware, invalidateBlocklist, isVpn };
