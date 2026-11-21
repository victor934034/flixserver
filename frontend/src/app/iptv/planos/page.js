'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import api from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import styles from '../../subscription/page.module.css';

const brl = v => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;

// Planos IPTV (design): mesmo card de plano da assinatura; o servidor cobra sempre o preço do plano IPTV
export default function IptvPlanosPage() {
  const router = useRouter();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    api.get('/iptv/plans').then(r => {
      const l = r.data || [];
      setPlans(l);
      setSel((l.find(p => p.highlight) || l[0])?.id || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [router]);

  const go = (plan) => router.push(`/pagamento?kind=iptv&plan_id=${encodeURIComponent(plan.id)}`);

  return (
    <>
      <Navbar />
      <main className={styles.page}>
        <div className={styles.glow} />
        <span style={{ position: 'relative', background: 'rgba(229,9,20,.16)', color: '#F87171', fontWeight: 900, fontSize: 12, letterSpacing: 1, padding: '6px 14px', borderRadius: 999, marginBottom: 14 }}>● IPTV AO VIVO</span>
        <h1 className={styles.hero}>TV ao vivo no FlixHome</h1>
        <ul className={styles.perks}>{['Canais ao vivo 24h', 'Filmes e séries do servidor', 'Até 2 telas ao mesmo tempo'].map(t => <li key={t}><i>✓</i>{t}</li>)}</ul>

        {loading ? <p className={styles.disabled}>Carregando…</p> : plans.length === 0 ? (
          <p className={styles.disabled}>Nenhum plano disponível no momento.</p>
        ) : (
          <div className={styles.plans}>
            {plans.map(plan => {
              const on = sel === plan.id;
              const months = plan.duration_months || 1;
              const gold = /custo|melhor/i.test(plan.badge || '');
              return (
                <div key={plan.id} className={`${styles.plan} ${on ? styles.planHL : ''}`} onClick={() => setSel(plan.id)} style={{ cursor: 'pointer' }}>
                  {plan.badge && <span className={`${styles.badge} ${gold ? styles.badgeGold : ''}`}>{plan.badge}</span>}
                  <div className={styles.planHead}><h2>{plan.name}</h2><span className={`${styles.radio} ${on ? styles.radioOn : ''}`} /></div>
                  <div className={styles.priceRow}><span className={styles.price}>{brl(plan.price)}</span><span className={styles.per}>/{months === 1 ? 'mês' : `${months} meses`}</span></div>
                  <div className={styles.sub}>{[plan.max_streams ? `${plan.max_streams} tela${plan.max_streams > 1 ? 's' : ''}` : null, 'canais ao vivo', `${months * 30} dias`].filter(Boolean).join(' · ')}</div>
                  <ul className={styles.feats}>
                    <li><i>✓</i>Canais ao vivo 24h</li>
                    {plan.description && <li><i>✓</i>{plan.description}</li>}
                    <li><i>✓</i>Ativação em até 30 min</li>
                  </ul>
                  <button className={on ? styles.ctaRed : styles.ctaGhost} onClick={(e) => { e.stopPropagation(); go(plan); }}>Assinar agora</button>
                </div>
              );
            })}
          </div>
        )}
        <p style={{ position: 'relative', color: '#777', fontSize: 13, marginTop: 28, textAlign: 'center', maxWidth: 520 }}>Ativação manual pelo admin após o pagamento (geralmente em até 30 min). Você acompanha o status na página IPTV.</p>
      </main>
    </>
  );
}
