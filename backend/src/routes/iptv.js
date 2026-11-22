const router  = require('express').Router();
const axios   = require('axios');
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');
const { castUrlFor } = require('./iptvCast');

// IPTV_SERVER_URL aceita vários servidores separados por vírgula
// (ex: http://onexx.live,http://onexx.sbs,http://onexx.pro). O primeiro é o
// principal; se ele cair, as chamadas ao painel tentam os seguintes.
function xcServers() {
  const list = (process.env.IPTV_SERVER_URL || '').split(',').map(u => u.trim().replace(/\/$/, '')).filter(Boolean);
  if (!list.length) throw new Error('IPTV_SERVER_URL não configurado no servidor');
  return list;
}
function xcServerUrl() { return xcServers()[0]; }

// GET na API player_api.php com failover entre os servidores.
async function xcApi(cred, action, extra = '', timeout = 12000) {
  let lastErr;
  for (const server of xcServers()) {
    try {
      const url = `${server}/player_api.php?username=${encodeURIComponent(cred.xc_username)}&password=${encodeURIComponent(cred.xc_password)}&action=${action}${extra}`;
      const { data } = await axios.get(url, { timeout });
      return data;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function getUserCred(userId) {
  const { data } = await supabase
    .from('iptv_credentials')
    .select('xc_username, xc_password, active')
    .eq('user_id', userId)
    .single();
  return data;
}

// GET /iptv/plans — planos IPTV ativos (público)
router.get('/plans', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('iptv_plans')
      .select('*')
      .eq('is_active', true)
      .order('order_index')
      .order('created_at');
    if (error) throw error;
    res.json((data || []).map(({ sigma_package_id, sigma_server_id, ...pub }) => pub));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /iptv/status — estado IPTV do usuário
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const cred = await getUserCred(req.user.id);

    if (cred && cred.active) {
      return res.json({ status: 'active' });
    }

    const { data: order } = await supabase
      .from('iptv_orders')
      .select('plan_name, amount, created_at')
      .eq('user_id', req.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (order) {
      return res.json({
        status:     'pending',
        plan_name:  order.plan_name,
        amount:     order.amount,
        ordered_at: order.created_at,
      });
    }

    res.json({ status: 'none' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /iptv/categories — proxy para XC API
router.get('/categories', authMiddleware, async (req, res) => {
  try {
    const cred = await getUserCred(req.user.id);
    if (!cred || !cred.active) return res.status(403).json({ error: 'Sem acesso IPTV ativo' });

    const data = await xcApi(cred, 'get_live_categories', '', 10000);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /iptv/streams?category_id=X — proxy para XC API
router.get('/streams', authMiddleware, async (req, res) => {
  try {
    const cred = await getUserCred(req.user.id);
    if (!cred || !cred.active) return res.status(403).json({ error: 'Sem acesso IPTV ativo' });

    const data = await xcApi(cred, 'get_live_streams', req.query.category_id ? `&category_id=${encodeURIComponent(req.query.category_id)}` : '', 15000);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /iptv/stream-url/:streamId — retorna URL de reprodução
router.get('/stream-url/:streamId', authMiddleware, async (req, res) => {
  try {
    const cred = await getUserCred(req.user.id);
    if (!cred || !cred.active) return res.status(403).json({ error: 'Sem acesso IPTV ativo' });

    const server = xcServerUrl();
    const { streamId } = req.params;
    const fmt = req.query.fmt || 'm3u8';
    const url = `${server}/live/${encodeURIComponent(cred.xc_username)}/${encodeURIComponent(cred.xc_password)}/${streamId}.${fmt}`;

    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /iptv/cast-url/:streamId — endereço do canal pro Chromecast (passa pelo proxy com CORS/HTTPS)
router.get('/cast-url/:streamId', authMiddleware, async (req, res) => {
  try {
    const cred = await getUserCred(req.user.id);
    if (!cred || !cred.active) return res.status(403).json({ error: 'Sem acesso IPTV ativo' });
    res.json({ url: castUrlFor(req, req.user.id, req.params.streamId) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /iptv/subscribe - compat com apps antigos: aponta pra pagina de pagamento propria (Asaas)
router.post('/subscribe', authMiddleware, async (req, res) => {
  const { plan_id } = req.body;
  if (!plan_id) return res.status(400).json({ error: 'plan_id obrigatório' });
  const base = process.env.FRONTEND_URL || 'https://flixhome.com.br';
  res.json({ init_point: `${base}/pagamento?kind=iptv&plan_id=${encodeURIComponent(plan_id)}` });
});

module.exports = router;
