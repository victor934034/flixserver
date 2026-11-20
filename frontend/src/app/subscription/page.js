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

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Assinatura</h1>
          {me && (
            <p className={styles.current}>
              Plano atual: <strong>{PLAN_LABELS[me.plan] || me.plan || 'Gratuito'}</strong>
              {hasValidPlan && me.plan_expires_at && (
                <> — válido até {new Date(me.plan_expires_at).toLocaleDateString('pt-BR')}</>
              )}
            </p>
          )}
        </div>

        {!enabled ? (
          <p className={styles.disabled}>Assinaturas não estão disponíveis no momento.</p>
        ) : plans.length === 0 ? (
          <p className={styles.disabled}>Nenhum plano disponível no momento.</p>
        ) : (
          <>
            {error && <p className={styles.error}>{error}</p>}
            {trial?.available && (
              <div style={{ background: 'rgba(229,9,20,.12)', border: '1px solid #E50914', borderRadius: 16, padding: 20, margin: '0 0 24px', display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div><strong style={{ fontSize: 18 }}>Teste grátis por {trial.days} dias</strong><div style={{ color: '#b3b3b3', fontSize: 14 }}>Sem cartão. Cancele quando quiser.</div></div>
                <button className={styles.btnSubscribe} style={{ width: 'auto', padding: '12px 24px' }} onClick={startTrial}>Começar teste grátis</button>
              </div>
            )}
            <div className={styles.grid}>
              {plans.map(plan => {
                const price = plan.promo_price != null ? plan.promo_price : plan.price;
                const hasPromo = plan.promo_price != null && plan.promo_price < plan.price;
                return (
                  <div key={plan.id} className={styles.card}>
                    <h2 className={styles.planName}>{plan.name}</h2>
                    <div className={styles.priceWrap}>
                      {hasPromo && <span className={styles.oldPrice}>R$ {Number(plan.price).toFixed(2)}</span>}
                      <span className={styles.price}>R$ {Number(price).toFixed(2)}</span>
                      <span className={styles.priceUnit}>/{plan.duration_days === 30 ? 'mês' : `${plan.duration_days}d`}</span>
                    </div>
                    {plan.max_streams && (
                      <p className={styles.feature}>{plan.max_streams} tela{plan.max_streams > 1 ? 's' : ''} simultânea{plan.max_streams > 1 ? 's' : ''}</p>
                    )}
                    {plan.description && <p className={styles.desc}>{plan.description}</p>}
                    <button
                      className={styles.btnSubscribe}
                      onClick={() => subscribe(plan)}
                    >
                      Assinar
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </>
  );
}
