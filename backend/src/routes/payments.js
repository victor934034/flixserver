const router = require('express').Router();
const axios = require('axios');
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/admin');

const MP_API = 'https://api.mercadopago.com';
const mpHeader = () => ({ Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` });

async function getPlansConfig() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'plans_config')
      .single();
    if (error) {
      console.error('[payments] getPlansConfig Supabase error:', error.code, error.message);
      return [];
    }
    if (!data) return [];
    return JSON.parse(data.value);
  } catch (e) {
    console.error('[payments] getPlansConfig exception:', e.message);
    return [];
  }
}

// GET /api/payments/plans — planos ativos (público)
router.get('/plans', async (req, res) => {
  try {
    const plans = await getPlansConfig();
    res.json(plans.filter(p => p.active));
  } catch (e) {
    console.error('[payments] GET /plans error:', e.message);
    res.status(500).json({ error: 'Erro ao carregar planos: ' + e.message });
  }
});

// GET /api/payments/plans/all — todos os planos (admin)
router.get('/plans/all', adminMiddleware, async (req, res) => {
  try {
    res.json(await getPlansConfig());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/payments/plans — salva planos (admin)
router.put('/plans', adminMiddleware, async (req, res) => {
  const { plans } = req.body;
  if (!Array.isArray(plans)) return res.status(400).json({ error: 'plans deve ser um array' });
  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: 'plans_config', value: JSON.stringify(plans), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/payments/subscribe — cria preferência MP e retorna init_point
router.post('/subscribe', authMiddleware, async (req, res) => {
  const { plan_id } = req.body;
  if (!plan_id) return res.status(400).json({ error: 'plan_id obrigatório' });

  try {
    const userId = req.user.id || req.user.userId;
    // Email disponível no JWT — não precisa consultar a tabela users
    const userEmail = req.user.email || '';

    const plans = await getPlansConfig();

    const plan = plans.find(p => p.id === plan_id && p.active);
    if (!plan) return res.status(400).json({ error: 'Plano não encontrado ou inativo' });

    const price = plan.promo_price != null ? plan.promo_price : plan.price;

    const backBase = process.env.FRONTEND_URL || 'https://movies0-movie.mgf7wb.easypanel.host';
    const notifUrl = process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}/api/payments/webhook/mp`
      : 'https://movies0-movie.mgf7wb.easypanel.host/api/payments/webhook/mp';

    const { data: pref } = await axios.post(
      `${MP_API}/checkout/preferences`,
      {
        items: [{
          id: plan.id,
          title: `FlixHome – ${plan.name}`,
          quantity: 1,
          unit_price: price,
          currency_id: 'BRL',
        }],
        payer: { email: userEmail },
        back_urls: {
          success: `${backBase}/subscription/sucesso`,
          failure: `${backBase}/subscription/falha`,
          pending: `${backBase}/subscription/pendente`,
        },
        notification_url: notifUrl,
        external_reference: `${userId}|${plan.id}|${plan.duration_days}`,
        auto_return: 'approved',
      },
      { headers: { ...mpHeader(), 'Content-Type': 'application/json' } }
    );

    res.json({ init_point: pref.init_point, preference_id: pref.id });
  } catch (e) {
    console.error('[MP] subscribe error:', e.response?.data || e.message);
    res.status(500).json({ error: e.response?.data?.message || e.message });
  }
});

// POST /api/payments/webhook/mp — notificação do Mercado Pago
router.post('/webhook/mp', async (req, res) => {
  res.sendStatus(200); // responde imediatamente

  const topic = req.query.topic || req.body?.type;
  const id = req.query.id || req.body?.data?.id;

  if (topic !== 'payment' || !id) return;

  try {
    const { data: payment } = await axios.get(
      `${MP_API}/v1/payments/${id}`,
      { headers: mpHeader() }
    );

    if (payment.status !== 'approved') return;

    const extRef = payment.external_reference || '';
    const [userId, planId, daysStr] = extRef.split('|');
    if (!userId || !planId) return;

    const days = parseInt(daysStr) || 30;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from('users')
      .update({ plan: planId, plan_expires_at: expiresAt, mp_subscription_id: String(payment.id) })
      .eq('id', userId);

    console.log(`[MP] Pagamento aprovado: user=${userId} plano=${planId} expira=${expiresAt}`);
  } catch (e) {
    console.error('[MP] webhook error:', e.message);
  }
});

module.exports = router;
