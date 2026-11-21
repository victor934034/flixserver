'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import { getToken, getMe } from '../../lib/auth';
import PlanPicker, { brl, titleOf, periodLabel, monthsOf, priceOf } from '../../components/PlanPicker';
import styles from './page.module.css';

const PLAN_LABELS = { free: 'Gratuito', basic: 'Básico', premium: 'Premium', admin: 'Admin' };

export default function SubscriptionPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [plans, setPlans] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [trial, setTrial] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [iptvPlans, setIptvPlans] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    Promise.all([
      getMe().catch(() => null),
      api.get('/payments/plans').then(r => r.data || []).catch(() => []),
      api.get('/settings').then(r => r.data || {}).catch(() => ({})),
      api.get('/payments/trial').then(r => r.data).catch(() => null),
      api.get('/iptv/plans').then(r => r.data || []).catch(() => []),
    ]).then(([user, plansData, settings, trialInfo, iptvData]) => {
      setIptvPlans(iptvData);
      setTrial(trialInfo);
      setMe(user);
      setPlans(plansData);
      setEnabled(settings.subscription_enabled !== 'false');
    }).finally(() => setLoading(false));
  }, [router]);

  function subscribe(plan) {
    router.push(`/pagamento?kind=${tab === 1 ? 'iptv' : 'plan'}&plan_id=${encodeURIComponent(plan.id)}`);
  }

  async function startTrial() {
    setError('');
    try {
      await api.post('/payments/trial/start');
      window.location.href = '/';
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível ativar o teste grátis.');
    }
  }

  const hasValidPlan = me?.plan && me?.plan_expires_at && new Date(me.plan_expires_at).getTime() > Date.now();

  if (loading) {
    return (
      <>
        <Navbar />
        <main className={styles.main}><p className={styles.loading}>Carregando...</p></main>
      </>
    );
  }

  const basic = plans.filter(p => !p.includes_iptv);
  const list = tab === 0 ? (basic.length ? basic : plans) : (iptvPlans.length ? iptvPlans : plans.filter(p => p.includes_iptv));
  const selPlan = list.find(p => p.id === selected) || list.find(p => p.highlight) || list[0] || null;
  const subtitleOf = p => [
    p.max_streams ? `${p.max_streams} tela${p.max_streams > 1 ? 's' : ''}` : null,
    tab === 1 ? 'canais ao vivo + app' : (p.max_streams >= 2 ? 'assistir juntos' : 'catálogo completo'),
  ].filter(Boolean).join(' · ');

  return (
    <>
      <Navbar />
      <main className={styles.page}>
        <div className={styles.glow} />
        <h1 className={styles.hero}>Assista sem limites.<br />Cancele quando quiser.</h1>
        <ul className={styles.perks}>{['Sem anúncios', 'Vários perfis', 'Até 4K', 'Telas simultâneas'].map(t => <li key={t}><i>✓</i>{t}</li>)}</ul>
        {me && hasValidPlan && me.plan_expires_at && (
          <p className={styles.current}>Plano atual: <b>{PLAN_LABELS[me.plan] || me.plan}</b> — válido até {new Date(me.plan_expires_at).toLocaleDateString('pt-BR')}</p>
        )}

        {!enabled ? (
          <p className={styles.disabled}>Assinaturas não estão disponíveis no momento.</p>
        ) : plans.length === 0 ? (
          <p className={styles.disabled}>Nenhum plano disponível no momento.</p>
        ) : (
          <>
            {error && <p className={styles.error}>{error}</p>}
            {trial?.available && (
              <div className={styles.trial}>
                <span className={styles.gift}>🎁</span>
                <div className={styles.trialTxt}><b>Teste grátis por {trial.days} dias</b><span>Sem cartão de crédito. Catálogo completo, cancele quando quiser.</span></div>
                <button className={styles.trialBtn} onClick={startTrial}>Começar teste grátis</button>
              </div>
            )}

            <div className={styles.seg} role="tablist">
              <button role="tab" aria-selected={tab === 0} className={tab === 0 ? styles.segOn : ''} onClick={() => { setTab(0); setSelected(null); }}>Filmes &amp; Séries</button>
              <button role="tab" aria-selected={tab === 1} className={tab === 1 ? styles.segOn : ''} onClick={() => { setTab(1); setSelected(null); }}>IPTV ao vivo</button>
            </div>

            {tab === 1 && <p className={styles.bundle}>🎁 Inclui a assinatura do app (filmes e séries) pelo mesmo período, sem pagar a mais.</p>}

            {list.length === 0 ? <p className={styles.disabled}>Nenhum plano nesta categoria no momento.</p> : (
              <>
                <PlanPicker key={tab} plans={list} selected={selPlan?.id} onSelect={p => p && setSelected(p.id)} subtitleOf={subtitleOf} />
                {selPlan && (
                  <button className={styles.ctaMain} onClick={() => subscribe(selPlan)}>
                    Continuar · {titleOf(selPlan)} · {periodLabel(monthsOf(selPlan))} · {brl(priceOf(selPlan))}
                  </button>
                )}
              </>
            )}

            <div className={styles.secure}>
              <span>🔒 Pagamento seguro</span>
              <b className={styles.pix}>PIX</b><b>Cartão</b><b>Boleto</b>
              <a href="/suporte">Precisa de ajuda?</a>
            </div>
          </>
        )}
      </main>
    </>
  );
}
