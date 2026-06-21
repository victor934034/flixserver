const axios = require('axios');

async function sendPush(tokens, title, body, data = {}) {
  const valid = (Array.isArray(tokens) ? tokens : [tokens])
    .filter(t => t && typeof t === 'string' && t.startsWith('ExponentPushToken'));
  if (!valid.length) return;

  const messages = valid.map(to => ({ to, sound: 'default', title, body, data }));
  // Expo aceita até 100 por requisição
  for (let i = 0; i < messages.length; i += 100) {
    try {
      await axios.post('https://exp.host/--/api/v2/push/send', messages.slice(i, i + 100), {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 10_000,
      });
    } catch (e) {
      console.error('[push] erro ao enviar chunk:', e.message?.slice(0, 100));
    }
  }
}

async function sendPushToAll(supabase, title, body, data = {}) {
  try {
    const { data: users } = await supabase
      .from('users')
      .select('push_token')
      .not('push_token', 'is', null);
    const tokens = (users || []).map(u => u.push_token).filter(Boolean);
    await sendPush(tokens, title, body, data);
  } catch (e) {
    console.error('[push] sendPushToAll erro:', e.message);
  }
}

// Envia para usuários cuja assinatura expira nos próximos `days` dias
async function sendExpiryWarnings(supabase, days = 3) {
  const now = new Date();
  const soon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  try {
    const { data: users } = await supabase
      .from('users')
      .select('push_token, name, plan_expires_at')
      .not('push_token', 'is', null)
      .not('plan_expires_at', 'is', null)
      .lte('plan_expires_at', soon.toISOString())
      .gte('plan_expires_at', now.toISOString());

    for (const u of users || []) {
      const exp = new Date(u.plan_expires_at);
      const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      const msg = diff <= 1 ? 'Sua assinatura expira hoje!' : `Sua assinatura expira em ${diff} dias.`;
      await sendPush([u.push_token], '⚠️ Assinatura FlixHome', msg, { screen: 'subscription' });
    }
  } catch (e) {
    console.error('[push] sendExpiryWarnings erro:', e.message);
  }
}

module.exports = { sendPush, sendPushToAll, sendExpiryWarnings };
