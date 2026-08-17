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
  const [subscribing, setSubscribing] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    Promise.all([
      getMe().catch(() => null),
      api.get('/payments/plans').then(r => r.data || []).catch(() => []),
      api.get('/settings').then(r => r.data || {}).catch(() => ({})),
    ]).then(([user, plansData, settings]) => {
      setMe(user);
      setPlans(plansData);
      setEnabled(settings.subscription_enabled !== 'false');
    }).finally(() => setLoading(false));
  }, [router]);

  async function subscribe(plan) {
    if (subscribing) return;
    setSubscribing(plan.id);
    setError('');
    try {
      const { data } = await api.post('/payments/subscribe', { plan_id: plan.id });
      window.location.href = data.init_point;
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao iniciar assinatura.');
      setSubscribing('');
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
                      disabled={subscribing === plan.id}
                    >
                      {subscribing === plan.id ? 'Redirecionando...' : 'Assinar'}
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
