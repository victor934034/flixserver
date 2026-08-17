'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import api from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import styles from '../../subscription/page.module.css';

export default function IptvPlanosPage() {
  const router = useRouter();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    api.get('/iptv/plans')
      .then(r => setPlans(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  async function subscribe(plan) {
    if (subscribing) return;
    setSubscribing(plan.id);
    setError('');
    try {
      const { data } = await api.post('/iptv/subscribe', { plan_id: plan.id });
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert('Solicitação enviada! O administrador ativará sua assinatura IPTV em breve.');
        router.push('/iptv');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível iniciar o pagamento.');
      setSubscribing('');
    }
  }

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
          <h1 className={styles.title}>Planos IPTV</h1>
        </div>

        {plans.length === 0 ? (
          <p className={styles.disabled}>Nenhum plano disponível no momento.</p>
        ) : (
          <>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.grid}>
              {plans.map(plan => {
                const price = plan.promo_price != null ? plan.promo_price : plan.price;
                const hasPromo = plan.promo_price != null && Number(plan.promo_price) < Number(plan.price);
                return (
                  <div key={plan.id} className={styles.card}>
                    <h2 className={styles.planName}>{plan.name}</h2>
                    <div className={styles.priceWrap}>
                      {hasPromo && <span className={styles.oldPrice}>R$ {Number(plan.price).toFixed(2)}</span>}
                      <span className={styles.price}>R$ {Number(price).toFixed(2)}</span>
                      <span className={styles.priceUnit}>/mês</span>
                    </div>
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
