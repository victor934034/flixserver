import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { KEY, useKeyDown } from '../hooks/useNav.js';
import api from '../api/index.js';

const ACCENT = '#c91c2c';

const TABS = [
  { key: 'streaming', label: 'Filmes & Séries' },
  { key: 'iptv',      label: 'Com IPTV' },
];

export default function SubscriptionScreen() {
  const { logout, user } = useAuth();
  const navigate         = useNavigate();
  const [searchParams]   = useSearchParams();
  const initialTab       = searchParams.get('tab') === 'iptv' ? 1 : 0;

  const [tab,         setTab]         = useState(initialTab);
  const [basicPlans,  setBasicPlans]  = useState([]);
  const [iptvPlans,   setIptvPlans]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [focused,     setFocused]     = useState(0); // 0..tabItems-1 = plan, last = logout
  const [status,      setStatus]      = useState('');
  const [subscribing, setSubscribing] = useState(false);

  const st = useRef({});

  useEffect(() => {
    Promise.all([
      api.get('/api/payments/plans').then(r => r.data || []).catch(() => []),
      api.get('/api/iptv/plans').then(r => r.data || []).catch(() => []),
    ]).then(([basic, iptv]) => {
      setBasicPlans(basic.filter(p => !p.includes_iptv));
      setIptvPlans(iptv.length > 0 ? iptv : basic.filter(p => p.includes_iptv));
    }).finally(() => setLoading(false));
  }, []);

  const plans    = tab === 0 ? basicPlans : iptvPlans;
  const total    = plans.length + 2; // plans + tabs + logout
  const tabFocus = focused < 2 ? focused : -1;
  const planFocus = focused >= 2 && focused < plans.length + 2 ? focused - 2 : -1;
  const logoutFocused = focused === plans.length + 2;

  st.current = { tab, plans, focused, total, subscribing, loading };

  useKeyDown(e => {
    const { tab, plans, focused, total, subscribing, loading } = st.current;
    if (loading || subscribing) return;
    const k = e.keyCode;

    if (k === KEY.UP) {
      e.preventDefault();
      setFocused(f => Math.max(0, f - 1));
    } else if (k === KEY.DOWN) {
      e.preventDefault();
      setFocused(f => Math.min(plans.length + 2, f + 1));
    } else if (k === KEY.LEFT) {
      e.preventDefault();
      if (focused < 2) {
        // navigate tabs
        if (tab > 0) { setTab(t => t - 1); setFocused(0); }
      } else if (focused >= 2 && focused <= plans.length + 1) {
        setFocused(f => Math.max(2, f - 1));
      }
    } else if (k === KEY.RIGHT) {
      e.preventDefault();
      if (focused < 2) {
        if (tab < TABS.length - 1) { setTab(t => t + 1); setFocused(1); }
      } else if (focused >= 2 && focused <= plans.length + 1) {
        setFocused(f => Math.min(plans.length + 1, f + 1));
      }
    } else if (k === KEY.ENTER) {
      e.preventDefault();
      if (focused === 0) { setTab(0); }
      else if (focused === 1) { setTab(1); }
      else if (focused >= 2 && focused <= plans.length + 1) {
        const plan = plans[focused - 2];
        if (plan) handleSubscribe(plan);
      } else {
        logout();
      }
    } else if (k === KEY.BACK) {
      e.preventDefault();
      logout();
    }
  }, []);

  async function handleSubscribe(plan) {
    setSubscribing(true);
    setStatus('Solicitando plano…');
    try {
      const endpoint = tab === 1 ? '/api/iptv/subscribe' : '/api/payments/subscribe';
      const { data } = await api.post(endpoint, { plan_id: plan.id });
      if (data.init_point) {
        setStatus('Acesse no celular para pagar:\n' + data.init_point);
      } else {
        setStatus('Solicitação enviada! O administrador foi notificado e ativará em breve.');
      }
    } catch (e) {
      setStatus('Erro: ' + ((e.response && e.response.data && e.response.data.error) || e.message));
    } finally {
      setSubscribing(false);
    }
  }

  const fmt = (val) => 'R$ ' + Number(val).toFixed(2).replace('.', ',');

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(135deg, #070710 0%, #0a0a14 100%)',
      color: '#fff', display: 'flex', flexDirection: 'column',
      alignItems: 'center', overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', paddingTop: 52, paddingBottom: 36 }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: ACCENT, letterSpacing: 8, marginBottom: 10 }}>FLIXHOME</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Escolha seu plano</div>
        <div style={{ fontSize: 15, color: '#666' }}>
          {tab === 0 ? 'Acesso ilimitado a filmes e séries' : 'Filmes, séries e canais ao vivo IPTV'}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4, marginBottom: 36, gap: 4 }}>
        {TABS.map((t, i) => {
          const isFoc = focused === i;
          const isActive = tab === i;
          return (
            <div
              key={t.key}
              onClick={() => { setTab(i); setFocused(i); }}
              style={{
                padding: '12px 36px', borderRadius: 10, cursor: 'pointer',
                background: isActive ? (i === 1 ? ACCENT : '#fff') : 'transparent',
                // Tab 0 active = white bg → must use dark text; Tab 1 active = red bg → white text
                color: isActive
                  ? (i === 0 ? '#111' : '#fff')
                  : (isFoc ? '#fff' : '#555'),
                fontSize: 15, fontWeight: 700,
                outline: isFoc && !isActive ? '2px solid rgba(255,255,255,0.4)' : 'none',
                outlineOffset: '2px',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {i === 1 && '📺 '}{t.label}
            </div>
          );
        })}
      </div>

      {/* Plans */}
      {loading ? (
        <div style={{ color: '#555', fontSize: 17 }}>Carregando planos…</div>
      ) : plans.length === 0 ? (
        <div style={{ color: '#444', fontSize: 16, textAlign: 'center', maxWidth: 480, lineHeight: 1.7 }}>
          {tab === 1
            ? 'Nenhum plano IPTV disponível no momento.\nEntre em contato com o administrador.'
            : 'Nenhum plano disponível no momento.'}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24, maxWidth: 1500 }}>
          {plans.map((plan, idx) => {
            const isFoc = planFocus === idx;
            const price = plan.promo_price != null ? plan.promo_price : plan.price;
            return (
              <div
                key={plan.id}
                onClick={() => { setFocused(idx + 2); handleSubscribe(plan); }}
                style={{
                  width: 300, padding: '32px 28px', borderRadius: 18, cursor: 'pointer',
                  background: isFoc ? 'rgba(255,255,255,0.06)' : '#111',
                  border: '2px solid ' + (isFoc ? '#fff' : plan.highlight ? ACCENT : '#1e1e1e'),
                  transition: 'background 0.15s, border-color 0.15s',
                  opacity: subscribing ? 0.7 : 1,
                  position: 'relative',
                }}
              >
                {plan.badge && (
                  <div style={{
                    position: 'absolute', top: -1, left: 24,
                    background: ACCENT, color: '#fff',
                    fontSize: 10, fontWeight: 800, letterSpacing: 1.5,
                    padding: '4px 12px', borderRadius: '0 0 8px 8px',
                  }}>
                    {plan.badge}
                  </div>
                )}
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, marginTop: plan.badge ? 10 : 0 }}>
                  {plan.name}
                </div>
                <div style={{ fontSize: 34, fontWeight: 900, color: isFoc ? '#fff' : ACCENT, marginBottom: 4 }}>
                  {fmt(price)}
                </div>
                {plan.promo_price != null && (
                  <div style={{ fontSize: 13, color: '#444', textDecoration: 'line-through', marginBottom: 4 }}>
                    {fmt(plan.price)}
                  </div>
                )}
                {plan.description && (
                  <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5, marginBottom: 16 }}>
                    {plan.description}
                  </div>
                )}
                {plan.max_streams && (
                  <div style={{ fontSize: 12, color: '#444', marginBottom: 16 }}>
                    {plan.max_streams} tela{plan.max_streams > 1 ? 's' : ''} simultânea{plan.max_streams > 1 ? 's' : ''}
                  </div>
                )}
                <div style={{
                  padding: '13px 0', borderRadius: 10, textAlign: 'center',
                  background: isFoc ? '#fff' : (plan.highlight ? ACCENT : '#1e1e1e'),
                  color: isFoc ? '#0a0a0a' : '#fff',
                  fontWeight: 700, fontSize: 15,
                  transition: 'background 0.15s, color 0.15s',
                }}>
                  {subscribing && planFocus === idx ? 'Aguarde…' : 'Assinar'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Status message */}
      {!!status && (
        <div style={{
          background: '#111', border: '1px solid #222', borderRadius: 12,
          padding: '20px 28px', maxWidth: 700, textAlign: 'center', marginBottom: 20,
          color: status.startsWith('Erro') ? '#ff6b6b' : '#fff',
          fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-line',
        }}>
          {status}
        </div>
      )}

      {/* Logout */}
      <div
        onClick={logout}
        style={{
          padding: '12px 32px', borderRadius: 8, cursor: 'pointer', marginTop: 8,
          border: '2px solid ' + (logoutFocused ? ACCENT : '#222'),
          color: logoutFocused ? ACCENT : '#444',
          fontWeight: 600, fontSize: 14,
          transition: 'border-color 0.15s, color 0.15s',
        }}
      >
        Sair da conta
      </div>

      <div style={{ position: 'absolute', bottom: 20, color: '#222', fontSize: 12 }}>
        Conectado como {user && user.email}
      </div>

      {/* D-pad hint */}
      <div style={{ position: 'absolute', bottom: 40, color: '#333', fontSize: 12 }}>
        ↑↓ navegar • ← → trocar aba/plano • ENTER confirmar
      </div>
    </div>
  );
}
