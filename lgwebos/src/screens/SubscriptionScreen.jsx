import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { KEY, useKeyDown } from '../hooks/useNav.js';
import api from '../api/index.js';

export default function SubscriptionScreen() {
  const { logout, user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [focused, setFocused] = useState(0);
  const [status, setStatus] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    api.get('/payments/plans')
      .then(r => setPlans(r.data || []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  useKeyDown(e => {
    if (loading || subscribing) return;
    const total = plans.length + 1; // +1 for logout button
    if (e.keyCode === KEY.UP) {
      e.preventDefault();
      setFocused(f => Math.max(0, f - 1));
    } else if (e.keyCode === KEY.DOWN) {
      e.preventDefault();
      setFocused(f => Math.min(total - 1, f + 1));
    } else if (e.keyCode === KEY.ENTER) {
      e.preventDefault();
      if (focused < plans.length) {
        handleSubscribe(plans[focused]);
      } else {
        logout();
      }
    }
  }, [loading, subscribing, focused, plans]);

  async function handleSubscribe(plan) {
    setSubscribing(true);
    setStatus('Gerando link de pagamento...');
    try {
      const { data } = await api.post('/payments/subscribe', { plan_id: plan.id });
      if (data.init_point) {
        setStatus(`Acesse no celular ou computador:\n${data.init_point}`);
      }
    } catch (e) {
      setStatus('Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #141414 100%)',
      color: '#fff', fontFamily: 'inherit',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 40, fontWeight: 900, color: '#E50914', letterSpacing: 6, marginBottom: 12 }}>
          FLIXHOME
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Escolha seu plano</div>
        <div style={{ fontSize: 16, color: '#999' }}>Acesso ilimitado a filmes e séries</div>
      </div>

      {loading ? (
        <div style={{ color: '#888', fontSize: 18 }}>Carregando planos...</div>
      ) : (
        <div style={{ display: 'flex', gap: 24, marginBottom: 40, flexWrap: 'wrap', justifyContent: 'center' }}>
          {plans.map((plan, idx) => (
            <div
              key={plan.id}
              onClick={() => { setFocused(idx); handleSubscribe(plan); }}
              style={{
                width: 280, padding: 32, borderRadius: 16, cursor: 'pointer',
                background: focused === idx ? 'rgba(229,9,20,0.15)' : '#1a1a1a',
                border: `2px solid ${focused === idx ? '#E50914' : plan.highlight ? '#E50914' : '#2a2a2a'}`,
                transform: focused === idx ? 'scale(1.04)' : 'scale(1)',
                transition: 'all 0.2s',
                opacity: subscribing ? 0.6 : 1,
              }}>
              {plan.badge && (
                <div style={{ color: '#E50914', fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 10 }}>
                  {plan.badge}
                </div>
              )}
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{plan.name}</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#E50914', marginBottom: 6 }}>
                {plan.promo_price != null
                  ? `R$ ${plan.promo_price.toFixed(2).replace('.', ',')}`
                  : `R$ ${plan.price.toFixed(2).replace('.', ',')}`}
              </div>
              {plan.promo_price != null && (
                <div style={{ color: '#555', fontSize: 14, textDecoration: 'line-through', marginBottom: 4 }}>
                  R$ {plan.price.toFixed(2).replace('.', ',')}
                </div>
              )}
              {plan.description && (
                <div style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>{plan.description}</div>
              )}
              <div style={{
                marginTop: 16, padding: '12px 0', borderRadius: 8, textAlign: 'center',
                background: focused === idx ? '#E50914' : '#2a2a2a',
                fontWeight: 700, fontSize: 15, transition: 'background 0.2s',
              }}>
                {subscribing && focused === idx ? 'Aguarde...' : 'Assinar'}
              </div>
            </div>
          ))}
        </div>
      )}

      {status && (
        <div style={{
          background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12,
          padding: 24, maxWidth: 700, textAlign: 'center', marginBottom: 32,
          color: status.startsWith('Erro') ? '#ff6b6b' : '#fff',
          fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-line',
        }}>
          {status.startsWith('Acesse') && (
            <div style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>
              Use seu celular para pagar — o acesso será liberado automaticamente após o pagamento.
            </div>
          )}
          {status}
        </div>
      )}

      <div
        onClick={logout}
        style={{
          padding: '12px 32px', borderRadius: 8, cursor: 'pointer',
          border: `2px solid ${focused === plans.length ? '#E50914' : '#333'}`,
          color: focused === plans.length ? '#E50914' : '#555',
          fontWeight: 600, fontSize: 15, transition: 'all 0.2s',
        }}>
        Sair da conta
      </div>

      <div style={{ position: 'absolute', bottom: 24, color: '#333', fontSize: 13 }}>
        Logado como {user?.email}
      </div>
    </div>
  );
}
