'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import { getToken, getMe } from '../../lib/auth';
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

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    Promise.all([
      getMe().catch(() => null),
      api.get('/payments/plans').then(r => r.data || []).catch(() => []),
      api.get('/settings').then(r => r.data || {}).catch(() => ({})),
      api.get('/payments/trial').then(r => r.data).catch(() => null),
    ]).then(([user, plansData, settings, trialInfo]) => {
      setTrial(trialInfo);
      setMe(user);
      setPlans(plansData);
      setEnabled(settings.subscription_enabled !== 'false');
    }).finally(() => setLoading(false));
  }, [router]);

  function subscribe(plan) {
    router.push(`/pagamento?kind=plan&plan_id=${encodeURIComponent(plan.id)}`);
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

  const brl = v => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
  const per = p => (p.duration_days ? (p.duration_days <= 31 ? '/mês' : p.duration_days <= 100 ? '/trimestre' : '/ano') : '/mês');
  const feats = p => [
    'Catálogo completo',
    p.max_streams ? `${p.max_streams} tela${p.max_streams > 1 ? 's' : ''} simultânea${p.max_streams > 1 ? 's' : ''}` : null,
    p.description || null,
    p.max_streams >= 2 ? 'Assistir juntos com chat e voz' : 'Salvar na lista',
  ].filter(Boolean).slice(0, 4);
  const shown = plans.filter(p => (tab === 1 ? p.includes_iptv : !p.includes_iptv));
  const list = shown.length ? shown : (tab === 0 ? plans : []);

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
              <button role="tab" aria-selected={tab === 0} className={tab === 0 ? styles.segOn : ''} onClick={() => setTab(0)}>Filmes &amp; Séries</button>
              <button role="tab" aria-selected={tab === 1} className={tab === 1 ? styles.segOn : ''} onClick={() => setTab(1)}>IPTV ao vivo</button>
            </div>

            <div className={styles.plans}>
              {list.length === 0 && <p className={styles.disabled}>Nenhum plano nesta categoria no momento.</p>}
              {list.map(plan => {
                const price = plan.promo_price != null ? plan.promo_price : plan.price;
                const hasPromo = plan.promo_price != null && plan.promo_price < plan.price;
                const gold = /custo|melhor/i.test(plan.badge || '');
                return (
                  <div key={plan.id} className={`${styles.plan} ${plan.highlight ? styles.planHL : ''}`}>
                    {plan.badge && <span className={`${styles.badge} ${gold ? styles.badgeGold : ''}`}>{plan.badge}</span>}
                    <div className={styles.planHead}><h2>{plan.name}</h2><span className={`${styles.radio} ${plan.highlight ? styles.radioOn : ''}`} /></div>
                    {hasPromo && <div className={styles.old}>{brl(plan.price)}</div>}
                    <div className={styles.priceRow}><span className={styles.price}>{brl(price)}</span><span className={styles.per}>{per(plan)}</span></div>
                    <div className={styles.sub}>{[plan.max_streams ? `${plan.max_streams} tela${plan.max_streams > 1 ? 's' : ''}` : null, plan.duration_days ? `${plan.duration_days} dias` : null].filter(Boolean).join(' · ')}</div>
                    <ul className={styles.feats}>{feats(plan).map(f => <li key={f}><i>✓</i>{f}</li>)}</ul>
                    <button className={plan.highlight ? styles.ctaRed : styles.ctaGhost} onClick={() => subscribe(plan)}>
                      {plan.highlight ? `Continuar com ${plan.name}` : 'Escolher'}
                    </button>
                  </div>
                );
              })}
            </div>

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
