import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { KEY, useKeyDown } from '../hooks/useNav.js';
import api from '../api/index.js';

const ACCENT = '#c91c2c';

const monthsOf = p => Number(p.duration_months) || Math.max(1, Math.round((Number(p.duration_days) || 30) / 30));
const priceOf = p => (p.promo_price != null && Number(p.promo_price) < Number(p.price) ? Number(p.promo_price) : Number(p.price));
const titleOf = p => {
  const m = /(COM|SEM)\s+ADULTO/i.exec(p.name || '');
  if (m) return m[1].toUpperCase() === 'COM' ? 'Com adulto 18+' : 'Sem adulto';
  const parts = String(p.name || '').split('·');
  return parts[parts.length - 1].trim();
};

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
  const [qrUrl,       setQrUrl]       = useState('');
  const [payPlan,     setPayPlan]     = useState(null);
  const [subscribing, setSubscribing] = useState(false);

  const [trial, setTrial] = useState(null);
  const [trialBusy, setTrialBusy] = useState(false);
  const off = trial && trial.available ? 1 : 0;
  const [selIdx, setSelIdx] = useState(0);
  const [period, setPeriod] = useState(null);
  const st = useRef({});

  useEffect(() => {
    Promise.all([
      api.get('/api/payments/plans').then(r => r.data || []).catch(() => []),
      api.get('/api/iptv/plans').then(r => r.data || []).catch(() => []),
      api.get('/api/payments/trial').then(r => r.data).catch(() => null),
    ]).then(([basic, iptv, tr]) => {
      setTrial(tr);
      setBasicPlans(basic.filter(p => !p.includes_iptv));
      setIptvPlans(iptv.length > 0 ? iptv : basic.filter(p => p.includes_iptv));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!qrUrl) return undefined;
    const t = setInterval(async () => {
      try {
        const { data } = await api.get('/api/auth/me');
        if (data && data.plan_expires_at && new Date(data.plan_expires_at).getTime() > Date.now()) window.location.reload();
      } catch (e) {}
    }, 4000);
    return () => clearInterval(t);
  }, [qrUrl]);

  const allPlans = tab === 0 ? basicPlans : iptvPlans;
  const periods  = [...new Set(allPlans.map(monthsOf))].sort((a, b) => a - b);
  const curPeriod = periods.includes(period) ? period : periods[0];
  const P        = periods.length;
  const plans    = allPlans.filter(p => monthsOf(p) === curPeriod)
    .sort((a, b) => (a.is_adult ? 1 : 0) - (b.is_adult ? 1 : 0) || (a.max_streams || 1) - (b.max_streams || 1));
  const bestMonthly = mo => Math.min(...allPlans.filter(p => monthsOf(p) === mo).map(p => priceOf(p) / mo));
  const saving = mo => (P && mo !== periods[0] ? Math.round((1 - bestMonthly(mo) / bestMonthly(periods[0])) * 100) : 0);
  useEffect(() => { setPeriod(null); }, [tab]);
  useEffect(() => { const h = plans.findIndex(p => p.highlight); setSelIdx(h >= 0 ? h : 0); }, [tab, curPeriod, basicPlans, iptvPlans]);
  const base     = 2 + P; // 0..1 abas, 2..base-1 períodos, depois planos
  const total    = plans.length + base;
  const tabFocus = focused < 2 ? focused : -1;
  const chipFocus = focused >= 2 && focused < base ? focused - 2 : -1;
  const planFocus = focused >= base && focused < plans.length + base ? focused - base : -1;
  const payFocus = focused === plans.length + base;
  const trialFocus = off === 1 && focused === plans.length + base + 1;
  const logoutFocused = focused === plans.length + base + 1 + off;
  const selPlan = plans[Math.min(selIdx, Math.max(0, plans.length - 1))];

  st.current = { tab, plans, focused, total, subscribing, loading, off, qrUrl, selIdx, P, periods, curPeriod };

  useKeyDown(e => {
    const { tab, plans, focused, total, subscribing, loading, off, qrUrl: qr0, P, periods, curPeriod } = st.current;
    if (loading || subscribing) return;
    const k = e.keyCode;
    if (qr0) { if (k === KEY.ENTER || k === KEY.BACK || k === KEY.BACKSPACE || k === 461) { e.preventDefault(); setQrUrl(''); setStatus(''); } return; }

    const n = plans.length;
    const base = 2 + P;
    const pay = n + base, tri = pay + 1, out = pay + 1 + off;
    const selFocus = base + Math.max(0, Math.min(st.current.selIdx, n - 1));
    const pi = Math.max(0, periods.indexOf(curPeriod));
    if (k === KEY.UP) {
      e.preventDefault();
      if (focused === pay || focused === tri) setFocused(n > 0 ? selFocus : (P > 0 ? 2 + pi : 0));
      else if (focused === out) setFocused(pay);
      else if (focused >= base && focused < pay) setFocused(P > 0 ? 2 + pi : (tab === 0 ? 0 : 1));
      else if (focused >= 2 && focused < base) setFocused(tab === 0 ? 0 : 1);
      else setFocused(0);
    } else if (k === KEY.DOWN) {
      e.preventDefault();
      if (focused < 2) setFocused(P > 0 ? 2 + pi : (n > 0 ? selFocus : out));
      else if (focused < base) setFocused(n > 0 ? selFocus : out);
      else if (focused < pay) setFocused(pay);
      else if (focused === pay || focused === tri) setFocused(out);
    } else if (k === KEY.LEFT) {
      e.preventDefault();
      if (focused < 2) { if (tab > 0) { setTab(t => t - 1); setFocused(0); } }
      else if (focused < base) { const i = Math.max(0, focused - 3); setPeriod(periods[i]); setFocused(2 + i); }
      else if (focused >= base && focused < pay) setFocused(f => Math.max(base, f - 1));
      else if (focused === tri) setFocused(pay);
    } else if (k === KEY.RIGHT) {
      e.preventDefault();
      if (focused < 2) { if (tab < TABS.length - 1) { setTab(t => t + 1); setFocused(1); } }
      else if (focused < base) { const i = Math.min(P - 1, focused - 1); setPeriod(periods[i]); setFocused(2 + i); }
      else if (focused >= base && focused < pay) setFocused(f => Math.min(pay - 1, f + 1));
      else if (focused === pay && off === 1) setFocused(tri);
    } else if (k === KEY.ENTER) {
      e.preventDefault();
      if (focused === 0) { setTab(0); }
      else if (focused === 1) { setTab(1); }
      else if (focused < base) { setPeriod(periods[focused - 2]); }
      else if (focused < pay) { setSelIdx(focused - base); setFocused(pay); }
      else if (focused === pay) { const plan = plans[Math.min(st.current.selIdx, n - 1)]; if (plan) handleSubscribe(plan); }
      else if (off === 1 && focused === tri) { startTrial(); }
      else { logout(); }
    } else if (k === KEY.BACK) {
      e.preventDefault();
      logout();
    }
  }, []);

  async function startTrial() {
    if (trialBusy) return;
    setTrialBusy(true);
    setStatus('Ativando seu teste grátis…');
    try {
      await api.post('/api/payments/trial/start');
      window.location.reload();
    } catch (e) {
      setStatus('Erro: ' + ((e.response && e.response.data && e.response.data.error) || 'Não foi possível ativar o teste grátis.'));
      setTrialBusy(false);
    }
  }

  async function handleSubscribe(plan) {
    setPayPlan(plan);
    setSubscribing(true);
    setStatus('Solicitando plano…');
    try {
      const endpoint = tab === 1 ? '/api/iptv/subscribe' : '/api/payments/subscribe';
      const { data } = await api.post(endpoint, { plan_id: plan.id });
      if (data.init_point) {
        setStatus('Escaneie o QR code com o celular para pagar (PIX, cartão ou boleto).\nOu acesse: ' + data.init_point);
        setQrUrl((api.defaults.baseURL || '') + '/api/payments/qr?text=' + encodeURIComponent(data.init_point));
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


  // ── Tela "Escaneie com o celular para pagar" (design TV) ──
  if (qrUrl) {
    return (
      <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', padding: '60px 90px', color: '#E5E5E5', display: 'flex', flexDirection: 'column',
        background: 'radial-gradient(ellipse at 15% 45%, rgba(229,9,20,0.14) 0%, #0A0A0A 55%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#E50914', letterSpacing: 10 }}>FLIXHOME</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#4ADE80' }}>🔒 Pagamento seguro</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 70 }}>
          <div style={{ width: 420, height: 420, borderRadius: 26, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src={qrUrl} alt="QR code" style={{ width: 396, height: 396 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 60, fontWeight: 900, letterSpacing: -1, lineHeight: 1.05 }}>Escaneie com o celular para pagar</div>
            <div style={{ fontSize: 28, color: '#A3A3A3', margin: '22px 0 28px' }}>PIX, cartão ou boleto — a página abre direto no seu celular.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 40, padding: '24px 30px', borderRadius: 18, background: '#141414', border: '1px solid #1F1F1F' }}>
              <div><div style={{ fontSize: 22, color: '#A3A3A3' }}>Plano</div><div style={{ fontSize: 34, fontWeight: 800 }}>{payPlan ? payPlan.name : ''}</div></div>
              <div><div style={{ fontSize: 22, color: '#A3A3A3' }}>Total</div><div style={{ fontSize: 34, fontWeight: 800 }}>{payPlan ? fmt(payPlan.promo_price != null ? payPlan.promo_price : payPlan.price) : ''}</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#4ADE80', fontSize: 26, fontWeight: 800 }}><span style={{ width: 14, height: 14, borderRadius: 7, background: '#22C55E', boxShadow: '0 0 0 6px rgba(34,197,94,0.25)' }} />Aguardando pagamento…</div>
            </div>
            <div style={{ fontSize: 24, color: '#A3A3A3', marginTop: 22 }}>A TV atualiza sozinha assim que o pagamento for confirmado.</div>
          </div>
        </div>
        <div style={{ padding: '18px 34px', borderRadius: 12, fontSize: 26, fontWeight: 800, color: '#fff', background: '#1F1F1F', border: '3px solid #fff', alignSelf: 'flex-start', transform: 'scale(1.06)', transformOrigin: 'left center' }}>Voltar aos planos</div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(135deg, #070710 0%, #0a0a14 100%)',
      color: '#fff', display: 'flex', flexDirection: 'column',
      alignItems: 'center', overflow: 'hidden',
    }}>
      {/* Cabeçalho (design TV): marca + título + benefícios à esquerda */}
      <div style={{ alignSelf: 'stretch', padding: '48px 70px 0', textAlign: 'left' }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#E50914', letterSpacing: 8, marginBottom: 8 }}>FLIXHOME</div>
        <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: -1 }}>Escolha seu plano</div>
        <div style={{ fontSize: 22, color: '#A3A3A3', marginTop: 8, display: 'flex', gap: 24 }}>
          {(tab === 0 ? ['Sem anúncios', 'Vários perfis', 'Até 4K', 'Telas simultâneas'] : ['Canais ao vivo 24h', 'Filmes e séries do servidor', 'Até 2 telas']).map(t => <span key={t}>{t}</span>)}
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

      {/* Período: 1 / 3 / 6 / 12 meses */}
      {!loading && P > 1 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
          {periods.map((mo, i) => {
            const on = mo === curPeriod; const foc = chipFocus === i; const sv = saving(mo);
            return (
              <div key={mo} onClick={() => { setPeriod(mo); setFocused(2 + i); }}
                style={{ minWidth: 130, textAlign: 'center', padding: '10px 22px', borderRadius: 14, cursor: 'pointer', boxSizing: 'border-box',
                  background: on ? '#E5E5E5' : '#141414', border: '3px solid ' + (foc ? '#fff' : on ? '#E5E5E5' : '#1F1F1F'),
                  transform: foc ? 'scale(1.08)' : 'none', transition: 'transform 0.2s' }}>
                <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, color: on ? '#111' : '#fff' }}>{mo}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: on ? '#444' : '#888' }}>{mo === 1 ? 'mês' : 'meses'}</div>
                <div style={{ fontSize: 14, fontWeight: 900, height: 18, color: on ? '#15803D' : '#4ADE80' }}>{sv >= 5 ? '-' + sv + '%' : ''}</div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && tab === 1 && iptvPlans.length > 0 && (
        <div style={{ fontSize: 16, fontWeight: 700, color: '#86EFAC', marginTop: 8 }}>🎁 Inclui a assinatura do app (filmes e séries) pelo mesmo período</div>
      )}

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
        <div style={{ display: 'flex', gap: 30, justifyContent: 'center', flexWrap: 'nowrap', margin: '18px 0 18px', maxWidth: 1700 }}>
          {plans.map((plan, idx) => {
            const isFoc = planFocus === idx;
            const price = plan.promo_price != null ? plan.promo_price : plan.price;
            const gold = /custo|melhor/i.test(plan.badge || '');
            const mo = monthsOf(plan);
            const per = mo === 1 ? 'por mês' : fmt(price / mo) + '/mês';
            const feats = [
              plan.max_streams ? plan.max_streams + (plan.max_streams > 1 ? ' telas simultâneas' : ' tela') : null,
              tab === 1 ? 'Canais ao vivo + app' : (plan.max_streams >= 2 ? 'Assistir juntos' : 'Catálogo completo'),
            ].filter(Boolean);
            return (
              <div
                key={plan.id}
                onClick={() => { setSelIdx(idx); setFocused(plans.length + base); }}
                style={{
                  width: 400, minHeight: 330, padding: '34px 30px 28px', borderRadius: 20, cursor: 'pointer', position: 'relative', boxSizing: 'border-box',
                  background: plan.highlight ? '#190f10' : '#141414',
                  border: '3px solid ' + (isFoc ? '#fff' : (selIdx === idx || plan.highlight) ? ACCENT : '#1F1F1F'),
                  boxShadow: plan.highlight ? '0 0 40px rgba(229,9,20,0.35)' : 'none',
                  transform: isFoc ? 'scale(1.06)' : 'none', transition: 'transform 0.2s ease-out, border-color 0.2s',
                  opacity: subscribing ? 0.7 : 1,
                }}
              >
                {plan.badge && (
                  <div style={{ position: 'absolute', top: -16, left: 28, background: gold ? '#FBBF24' : ACCENT, color: gold ? '#1a1200' : '#fff', fontSize: 15, fontWeight: 900, padding: '6px 16px', borderRadius: 999 }}>
                    {plan.badge}
                  </div>
                )}
                <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 14 }}>{titleOf(plan)}</div>
                {plan.promo_price != null && plan.promo_price < plan.price && (
                  <div style={{ fontSize: 20, color: '#777', textDecoration: 'line-through' }}>{fmt(plan.price)}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 18 }}>
                  <span style={{ fontSize: 52, fontWeight: 900, lineHeight: 1 }}>{fmt(price)}</span>
                  <span style={{ fontSize: 22, color: '#A3A3A3', paddingBottom: 6 }}>{per}</span>
                </div>
                {feats.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, color: '#E5E5E5', marginBottom: 8 }}>
                    <span style={{ color: '#22C55E', fontWeight: 900 }}>✓</span>{f}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Ação principal: pagar pelo celular (QR) */}
      {!loading && plans.length > 0 && (
        <div style={{ alignSelf: 'stretch', padding: '10px 70px 0', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div onClick={() => selPlan && handleSubscribe(selPlan)} style={{ background: ACCENT, padding: '18px 32px', borderRadius: 12, fontSize: 24, fontWeight: 800, cursor: 'pointer', border: '3px solid ' + (payFocus ? '#fff' : ACCENT), transform: payFocus ? 'scale(1.06)' : 'none', transition: 'transform 0.2s' }}>📱 Pagar pelo celular{selPlan ? ' · ' + titleOf(selPlan) + ' · ' + (monthsOf(selPlan) === 1 ? '1 mês' : monthsOf(selPlan) + ' meses') : ''}</div>
          {off === 1 && <div onClick={startTrial} style={{ background: '#1F1F1F', padding: '18px 32px', borderRadius: 12, fontSize: 24, fontWeight: 800, cursor: 'pointer', border: '3px solid ' + (trialFocus ? '#fff' : 'transparent'), transform: trialFocus ? 'scale(1.06)' : 'none', transition: 'transform 0.2s' }}>Começar teste grátis · {trial.days} dias</div>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 22, fontSize: 20, color: '#A3A3A3', alignItems: 'center' }}>
            <span><b style={{ border: '2px solid #666', borderRadius: 8, padding: '3px 10px', marginRight: 8, color: '#E5E5E5' }}>◀ ▶</b>Escolher</span>
            <span><b style={{ border: '2px solid #666', borderRadius: 8, padding: '3px 10px', marginRight: 8, color: '#E5E5E5' }}>OK</b>Selecionar</span>
            <span><b style={{ border: '2px solid #666', borderRadius: 8, padding: '3px 10px', marginRight: 8, color: '#E5E5E5' }}>Voltar</b>Sair</span>
          </div>
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
          {qrUrl && <img src={qrUrl} alt="QR code" style={{ width: 220, height: 220, background: '#fff', borderRadius: 12, padding: 8, display: 'block', margin: '0 auto 14px' }} />}
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

    </div>
  );
}
