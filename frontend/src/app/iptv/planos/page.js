'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import api from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import PlanPicker, { brl, titleOf, periodLabel, monthsOf, priceOf } from '../../../components/PlanPicker';
import styles from '../../subscription/page.module.css';

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

        <p className={styles.bundle} style={{ margin: '0 0 24px' }}>🎁 Inclui a assinatura do app (filmes e séries) pelo mesmo período, sem pagar a mais.</p>

        {loading ? <p className={styles.disabled}>Carregando…</p> : plans.length === 0 ? (
          <p className={styles.disabled}>Nenhum plano disponível no momento.</p>
        ) : (() => {
          const cur = plans.find(p => p.id === sel) || plans[0];
          return (
            <>
              <PlanPicker plans={plans} selected={cur.id} onSelect={p => p && setSel(p.id)}
                subtitleOf={p => [p.max_streams ? `${p.max_streams} tela${p.max_streams > 1 ? 's' : ''}` : null, 'canais ao vivo + app'].filter(Boolean).join(' · ')} />
              <button className={styles.ctaMain} onClick={() => go(cur)}>
                Assinar agora · {titleOf(cur)} · {periodLabel(monthsOf(cur))} · {brl(priceOf(cur))}
              </button>
            </>
          );
        })()}
        <p style={{ position: 'relative', color: '#777', fontSize: 13, marginTop: 28, textAlign: 'center', maxWidth: 520 }}>Ativação manual pelo admin após o pagamento (geralmente em até 30 min). Você acompanha o status na página IPTV.</p>
      </main>
    </>
  );
}
