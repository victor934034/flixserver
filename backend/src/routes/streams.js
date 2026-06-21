const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

const HEARTBEAT_TIMEOUT_SEC = 60; // sessão expira se sem heartbeat por 60s
const FREE_MAX_STREAMS = 1;       // padrão para planos não mapeados

async function getMaxStreams(plan) {
  if (!plan) return FREE_MAX_STREAMS;
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'plans_config')
      .single();
    if (!data) return FREE_MAX_STREAMS;
    const plans = JSON.parse(data.value);
    const found = plans.find(p => p.id === plan);
    return found?.max_streams ?? FREE_MAX_STREAMS;
  } catch {
    return FREE_MAX_STREAMS;
  }
}

async function isSubscriptionEnabled() {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'subscription_enabled')
      .single();
    return data?.value === 'true';
  } catch {
    return false;
  }
}

// POST /api/streams/start
router.post('/start', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { session_id, content_title } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id obrigatório' });

  try {
    const subEnabled = await isSubscriptionEnabled();

    if (subEnabled) {
      // Busca plano atual do usuário
      const { data: userRow } = await supabase
        .from('users')
        .select('plan, plan_expires_at')
        .eq('id', userId)
        .single();

      const now = new Date();
      const validPlan = userRow?.plan && userRow?.plan_expires_at
        && new Date(userRow.plan_expires_at).getTime() > now.getTime();

      const plan = validPlan ? userRow.plan : null;
      const maxStreams = await getMaxStreams(plan);

      // Conta streams ativos (heartbeat nos últimos 60s, excluindo a própria sessão)
      const cutoff = new Date(now.getTime() - HEARTBEAT_TIMEOUT_SEC * 1000).toISOString();
      const { count } = await supabase
        .from('active_streams')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .neq('session_id', session_id)
        .gte('last_heartbeat', cutoff);

      if ((count || 0) >= maxStreams) {
        return res.status(429).json({
          error: 'limit_reached',
          max_streams: maxStreams,
          active: count,
          plan: plan || 'free',
        });
      }
    }

    // Upsert da sessão (tolerante a reconexão com mesmo session_id)
    await supabase
      .from('active_streams')
      .upsert({
        user_id: userId,
        session_id,
        content_title: content_title || null,
        last_heartbeat: new Date().toISOString(),
        started_at: new Date().toISOString(),
      }, { onConflict: 'session_id' });

    res.json({ ok: true });
  } catch (e) {
    console.error('[streams] start error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/streams/heartbeat/:sessionId
router.post('/heartbeat/:sessionId', authMiddleware, async (req, res) => {
  const { sessionId } = req.params;
  try {
    await supabase
      .from('active_streams')
      .update({ last_heartbeat: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('user_id', req.user.id);
    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // silencia — não deve interromper reprodução
  }
});

// DELETE /api/streams/:sessionId
router.delete('/:sessionId', authMiddleware, async (req, res) => {
  try {
    await supabase
      .from('active_streams')
      .delete()
      .eq('session_id', req.params.sessionId)
      .eq('user_id', req.user.id);
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

module.exports = router;
