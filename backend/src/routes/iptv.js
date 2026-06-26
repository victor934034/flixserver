const router  = require('express').Router();
const axios   = require('axios');
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

const MP_API   = 'https://api.mercadopago.com';
const mpHeader = () => ({ Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` });

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

// GET /iptv/status — estado IPTV do usuário (requer auth)
// Retorna: { status: 'active'|'pending'|'none', ...extras }
router.get('/status', authMiddleware, async (req, res) => {
  try {
    // 1. Verifica credenciais ativas
    const { data: cred } = await supabase
      .from('iptv_credentials')
      .select('server_url, xc_username, xc_password, active')
      .eq('user_id', req.user.id)
      .single();

    if (cred && cred.active) {
      return res.json({
        status: 'active',
        server_url:   cred.server_url,
        xc_username:  cred.xc_username,
        xc_password:  cred.xc_password,
      });
    }

    // 2. Verifica pedido pendente
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
        status:    'pending',
        plan_name: order.plan_name,
        amount:    order.amount,
        ordered_at: order.created_at,
      });
    }

    // 3. Sem assinatura
    res.json({ status: 'none' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /iptv/me — credenciais XC (mantido para compatibilidade)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('iptv_credentials')
      .select('server_url, xc_username, xc_password, active')
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Sem credenciais IPTV vinculadas' });
    if (!data.active) return res.status(403).json({ error: 'Assinatura IPTV inativa' });

    res.json({ server_url: data.server_url, xc_username: data.xc_username, xc_password: data.xc_password });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /iptv/subscribe — cria preferência MP para plano IPTV (requer auth)
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

    const backBase  = process.env.FRONTEND_URL || 'https://movies0-movie.mgf7wb.easypanel.host';
    const notifUrl  = process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}/api/payments/webhook/mp`
      : 'https://movies0-movie.mgf7wb.easypanel.host/api/payments/webhook/mp';

    const { data: pref } = await axios.post(
      `${MP_API}/checkout/preferences`,
      {
        items: [{
          id:         plan.id,
          title:      `FlixHome IPTV – ${plan.name}`,
          quantity:   1,
          unit_price: Number(plan.price),
          currency_id: 'BRL',
        }],
        payer:     { email: userEmail },
        back_urls: {
          success: `${backBase}/iptv/sucesso`,
          failure: `${backBase}/iptv/falha`,
          pending: `${backBase}/iptv/pendente`,
        },
        notification_url: notifUrl,
        // Prefixo 'iptv|' distingue do pagamento de filmes/séries no webhook
        external_reference: `iptv|${userId}|${plan.id}|${plan.price}`,
        auto_return: 'approved',
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
