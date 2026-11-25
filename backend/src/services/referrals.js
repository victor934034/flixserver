const crypto = require('crypto');
const { sendPush } = require('./notifications');

// Mesmo alfabeto do "Assistir juntos": sem 0/O e 1/I, que se confundem.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 7 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');

async function referralConfig(supabase) {
  const { data } = await supabase.from('system_settings').select('key, value').in('key', ['referral_enabled', 'referral_days']);
  const map = Object.fromEntries((data || []).map(r => [r.key, r.value]));
  return { enabled: map.referral_enabled === 'true', days: Math.min(90, Math.max(1, parseInt(map.referral_days) || 7)) };
}

async function ensureCode(supabase, userId) {
  const read = async () => {
    const { data, error } = await supabase.from('users').select('referral_code').eq('id', userId).single();
    if (error) throw error;
    return data.referral_code;
  };
  let code = await read();
  for (let attempt = 0; !code && attempt < 5; attempt++) {
    // só grava se ainda estiver vazio; código repetido bate no índice único e tenta outro
    await supabase.from('users').update({ referral_code: newCode() }).eq('id', userId).is('referral_code', null);
    code = await read();
  }
  return code;
}

// Chamado quando um pagamento de plano ou IPTV é confirmado. Premia quem indicou
// na PRIMEIRA compra do amigo; a condição rewarded_at nulo impede prêmio em dobro.
// getPlans devolve os planos do app (usado quando quem indicou está sem plano).
async function rewardReferrer(supabase, referredId, getPlans) {
  const cfg = await referralConfig(supabase);
  if (!cfg.enabled) return false;

  const { data: claimed, error } = await supabase.from('referrals')
    .update({ rewarded_at: new Date().toISOString(), reward_days: cfg.days })
    .eq('referred_id', referredId).is('rewarded_at', null)
    .select('id, referrer_id');
  if (error || !claimed?.length) return false;

  const { id, referrer_id: referrerId } = claimed[0];
  try {
    const { data: user, error: userError } = await supabase.from('users')
      .select('plan, plan_expires_at, push_token, notification_prefs').eq('id', referrerId).single();
    if (userError) throw userError;

    const active = user.plan_expires_at && new Date(user.plan_expires_at) > new Date();
    let planId = active ? user.plan : null;
    if (!planId) {
      const plans = (await getPlans()).filter(p => p.active).sort((a, b) => a.price - b.price);
      planId = plans[0]?.id;
    }
    if (!planId) throw new Error('nenhum plano ativo para conceder');

    const base = active ? new Date(user.plan_expires_at) : new Date();
    const expiresAt = new Date(base.getTime() + cfg.days * 86400000).toISOString();
    const { error: saveError } = await supabase.from('users')
      .update({ plan: planId, plan_expires_at: expiresAt }).eq('id', referrerId);
    if (saveError) throw saveError;

    console.log(`[indicação] +${cfg.days} dias user=${referrerId} expira=${expiresAt}`);
    if (user.push_token && user.notification_prefs?.billing !== false) {
      await sendPush([user.push_token], '🎁 Você ganhou dias grátis!',
        `Seu amigo assinou: +${cfg.days} dias na sua conta.`, { screen: 'subscription' });
    }
    return true;
  } catch (e) {
    // devolve a indicação pra "pendente" pra não perder o prêmio por uma falha
    await supabase.from('referrals').update({ rewarded_at: null, reward_days: null }).eq('id', id);
    throw e;
  }
}

module.exports = { referralConfig, ensureCode, rewardReferrer };
