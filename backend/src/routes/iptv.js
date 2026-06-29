const router  = require('express').Router();
const axios   = require('axios');
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

const MP_API   = 'https://api.mercadopago.com';
const mpHeader = () => ({ Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` });

function xcServerUrl() {
  const url = process.env.IPTV_SERVER_URL;
  if (!url) throw new Error('IPTV_SERVER_URL não configurado no servidor');
  return url.replace(/\/$/, '');
}

async function getUserCred(userId) {
  const { data } = await supabase
    .from('iptv_credentials')
    .select('xc_username, xc_password, active, server_url')
    .eq('user_id', userId)
    .single();
  return data;
}

function resolveServer(cred) {
  let url;
  if (cred?.server_url === 'SLOT_2') {
    url = process.env.IPTV_SERVER_URL_2;
    if (!url) throw new Error('IPTV_SERVER_URL_2 não configurado no servidor');
  } else {
    url = process.env.IPTV_SERVER_URL;
    if (!url) throw new Error('IPTV_SERVER_URL não configurado no servidor');
  }
  return url.replace(/\/$/, '');
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
    res.json(data || []);
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

    const server = resolveServer(cred);
    const url = `${server}/player_api.php?username=${encodeURIComponent(cred.xc_username)}&password=${encodeURIComponent(cred.xc_password)}&action=get_live_categories`;

    const { data } = await axios.get(url, { timeout: 10000 });
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

    const server = resolveServer(cred);
    let url = `${server}/player_api.php?username=${encodeURIComponent(cred.xc_username)}&password=${encodeURIComponent(cred.xc_password)}&action=get_live_streams`;
    if (req.query.category_id) url += `&category_id=${encodeURIComponent(req.query.category_id)}`;

    const { data } = await axios.get(url, { timeout: 15000 });
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

    const server = resolveServer(cred);
    const { streamId } = req.params;
    const url = `${server}/live/${encodeURIComponent(cred.xc_username)}/${encodeURIComponent(cred.xc_password)}/${streamId}.ts`;

    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /iptv/subscribe — cria preferência MP para plano IPTV
router.post('/subscribe', authMiddleware, async (req, res) => {
  const { plan_id } = req.body;
  if (!plan_id) return res.status(400).json({ error: 'plan_id obrigatório' });

  try {
    const { data: plan, error: planErr } = await supabase
      .from('iptv_plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single();

    if (planErr || !plan) return res.status(404).json({ error: 'Plano não encontrado ou inativo' });

    const userId    = req.user.id;
    const userEmail = req.user.email || '';

    const backBase = process.env.FRONTEND_URL || 'https://movies0-movie.mgf7wb.easypanel.host';
    const notifUrl = process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}/api/payments/webhook/mp`
      : 'https://movies0-movie.mgf7wb.easypanel.host/api/payments/webhook/mp';

    const { data: pref } = await axios.post(
      `${MP_API}/checkout/preferences`,
      {
        items: [{
          id:          plan.id,
          title:       `FlixHome IPTV – ${plan.name}`,
          quantity:    1,
          unit_price:  Number(plan.price),
          currency_id: 'BRL',
        }],
        payer:     { email: userEmail },
        back_urls: {
          success: `${backBase}/iptv/sucesso`,
          failure: `${backBase}/iptv/falha`,
          pending: `${backBase}/iptv/pendente`,
        },
        notification_url:   notifUrl,
        external_reference: `iptv|${userId}|${plan.id}|${plan.price}`,
        auto_return:        'approved',
      },
      { headers: { ...mpHeader(), 'Content-Type': 'application/json' } }
    );

    res.json({ init_point: pref.init_point, preference_id: pref.id });
  } catch (err) {
    console.error('[IPTV subscribe]', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

module.exports = router;
