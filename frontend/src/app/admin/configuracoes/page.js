'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import styles from '../filmes/novo/page.module.css';

const DEFAULT_PLANS = [
  { id: 'monthly_2',   name: 'Mensal · 2 Telas',     price: 19.90,  duration_days: 30,  active: true,  badge: null,           description: 'Acesso por 1 mês',       highlight: false, max_streams: 2 },
  { id: 'monthly_3',   name: 'Mensal · 3 Telas',     price: 27.90,  duration_days: 30,  active: true,  badge: null,           description: 'Acesso por 1 mês',       highlight: false, max_streams: 3 },
  { id: 'monthly_5',   name: 'Mensal · 5 Telas',     price: 39.90,  duration_days: 30,  active: true,  badge: null,           description: 'Acesso por 1 mês',       highlight: false, max_streams: 5 },
  { id: 'quarterly_2', name: 'Trimestral · 2 Telas', price: 49.90,  duration_days: 90,  active: true,  badge: null,           description: 'Economia de 16%',        highlight: false, max_streams: 2 },
  { id: 'quarterly_3', name: 'Trimestral · 3 Telas', price: 69.90,  duration_days: 90,  active: true,  badge: 'MAIS POPULAR', description: 'Economia de 16%',        highlight: true,  max_streams: 3 },
  { id: 'quarterly_5', name: 'Trimestral · 5 Telas', price: 99.90,  duration_days: 90,  active: true,  badge: null,           description: 'Economia de 16%',        highlight: false, max_streams: 5 },
  { id: 'yearly_2',    name: 'Anual · 2 Telas',      price: 149.90, duration_days: 365, active: true,  badge: null,           description: 'Economia de 37%',        highlight: false, max_streams: 2 },
  { id: 'yearly_3',    name: 'Anual · 3 Telas',      price: 199.90, duration_days: 365, active: true,  badge: null,           description: 'Economia de 37%',        highlight: false, max_streams: 3 },
  { id: 'yearly_5',    name: 'Anual · 5 Telas',      price: 279.90, duration_days: 365, active: true,  badge: 'MELHOR CUSTO', description: 'Economia de 37%',        highlight: false, max_streams: 5 },
];

export default function Configuracoes() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [msg, setMsg] = useState('');

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansSaving, setPlansSaving] = useState(false);
  const [plansMsg, setPlansMsg] = useState('');

  useEffect(() => {
    api.get('/settings').then(r => setSettings(r.data)).finally(() => setLoading(false));
    api.get('/payments/plans/all')
      .then(r => setPlans(r.data?.length ? r.data : DEFAULT_PLANS))
      .catch(() => setPlans(DEFAULT_PLANS))
      .finally(() => setPlansLoading(false));
  }, []);

  async function toggle(key, currentValue) {
    const newVal = currentValue === 'true' ? 'false' : 'true';
    setSaving(key);
    setMsg('');
    try {
      await api.put(`/settings/${key}`, { value: newVal });
      setSettings(prev => ({ ...prev, [key]: newVal }));
      setMsg('Salvo!');
    } catch (e) {
      setMsg('Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving('');
    }
  }

  async function sendNotification(title, body) {
    setSaving('notify');
    try {
      await api.post('/admin/notify', { title, body });
      setMsg('Notificação enviada!');
    } catch {
      setMsg('Erro ao enviar notificação');
    } finally {
      setSaving('');
    }
  }

  function updatePlan(idx, field, value) {
    setPlans(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  async function savePlans() {
    setPlansSaving(true);
    setPlansMsg('');
    try {
      await api.put('/payments/plans', { plans });
      setPlansMsg('Planos salvos!');
    } catch (e) {
      setPlansMsg('Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setPlansSaving(false);
    }
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>;

  const subEnabled = settings.subscription_enabled === 'true';

  return (
    <div>
      <h1 className={styles.heading}>Configurações</h1>

      {/* ── ASSINATURA GLOBAL ── */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ color: '#fff', marginBottom: 16 }}>Assinatura</h3>
        <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 24, border: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p style={{ color: '#fff', fontWeight: 600, margin: 0 }}>
                Sistema de assinatura:{' '}
                <span style={{ color: subEnabled ? '#4caf50' : '#ff6b6b' }}>
                  {subEnabled ? 'ATIVADO' : 'DESATIVADO'}
                </span>
              </p>
              <p style={{ color: '#888', fontSize: 13, margin: '4px 0 0' }}>
                {subEnabled
                  ? 'Usuários sem assinatura ativa são redirecionados para a tela de planos.'
                  : 'Todos os usuários têm acesso livre, independente de assinatura.'}
              </p>
            </div>
            <button
              onClick={() => toggle('subscription_enabled', settings.subscription_enabled)}
              disabled={saving === 'subscription_enabled'}
              style={{
                padding: '10px 24px', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                border: 'none', background: subEnabled ? '#b71c1c' : '#1b5e20', color: '#fff',
                opacity: saving === 'subscription_enabled' ? 0.6 : 1,
              }}>
              {saving === 'subscription_enabled' ? 'Salvando...' : subEnabled ? 'Desativar' : 'Ativar'}
            </button>
          </div>
          {msg && <p style={{ color: msg.startsWith('Erro') ? '#ff6b6b' : '#4caf50', fontSize: 13, margin: 0 }}>{msg}</p>}
        </div>
      </section>

      {/* ── GERENCIAR PLANOS ── */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ color: '#fff', marginBottom: 16 }}>Planos de Assinatura</h3>
        {plansLoading ? (
          <p style={{ color: '#888' }}>Carregando planos...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {plans.map((plan, idx) => (
              <div key={plan.id} style={{
                background: '#1a1a1a', borderRadius: 12, padding: 24,
                border: `1px solid ${plan.active ? '#2a2a2a' : '#1a1a1a'}`,
                opacity: plan.active ? 1 : 0.55,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{plan.name}</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <span style={{ color: plan.active ? '#4caf50' : '#ff6b6b', fontSize: 13, fontWeight: 600 }}>
                      {plan.active ? 'Ativo' : 'Inativo'}
                    </span>
                    <input
                      type="checkbox"
                      checked={plan.active}
                      onChange={e => updatePlan(idx, 'active', e.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <label style={{ color: '#888', fontSize: 13 }}>
                    Preço (R$)
                    <input
                      type="number" step="0.01" min="0"
                      value={plan.price}
                      onChange={e => updatePlan(idx, 'price', parseFloat(e.target.value) || 0)}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ color: '#888', fontSize: 13 }}>
                    Preço promocional (R$) — deixe vazio para desativar
                    <input
                      type="number" step="0.01" min="0"
                      value={plan.promo_price ?? ''}
                      onChange={e => {
                        const v = e.target.value;
                        updatePlan(idx, 'promo_price', v === '' ? null : parseFloat(v) || 0);
                      }}
                      placeholder="Sem promoção"
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ color: '#888', fontSize: 13 }}>
                    Badge (ex: MAIS POPULAR)
                    <input
                      type="text"
                      value={plan.badge ?? ''}
                      onChange={e => updatePlan(idx, 'badge', e.target.value || null)}
                      placeholder="Nenhum"
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ color: '#888', fontSize: 13 }}>
                    Descrição
                    <input
                      type="text"
                      value={plan.description ?? ''}
                      onChange={e => updatePlan(idx, 'description', e.target.value)}
                      style={inputStyle}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <label style={{ color: '#888', fontSize: 13 }}>
                    Telas simultâneas
                    <input
                      type="number" min="1" max="99"
                      value={plan.max_streams ?? 1}
                      onChange={e => updatePlan(idx, 'max_streams', parseInt(e.target.value) || 1)}
                      style={inputStyle}
                    />
                  </label>
                </div>

                <label style={{ color: '#888', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={plan.highlight}
                    onChange={e => updatePlan(idx, 'highlight', e.target.checked)}
                  />
                  Destaque (borda vermelha no app)
                </label>
              </div>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={savePlans}
                disabled={plansSaving}
                style={{
                  padding: '12px 32px', borderRadius: 8, background: '#E50914', color: '#fff',
                  border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                  opacity: plansSaving ? 0.6 : 1,
                }}>
                {plansSaving ? 'Salvando...' : 'Salvar planos'}
              </button>
              {plansMsg && (
                <span style={{ color: plansMsg.startsWith('Erro') ? '#ff6b6b' : '#4caf50', fontSize: 13 }}>
                  {plansMsg}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── NOTIFICAÇÕES ── */}
      <section>
        <h3 style={{ color: '#fff', marginBottom: 16 }}>Notificações Push</h3>
        <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 24, border: '1px solid #2a2a2a' }}>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
            Notificações são enviadas automaticamente quando você adiciona filmes, séries ou episódios. Também é possível enviar manualmente.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => sendNotification('📢 Novidade FlixHome!', 'Acabamos de adicionar novos conteúdos. Confira agora!')}
              disabled={saving === 'notify'}
              style={{ padding: '10px 20px', borderRadius: 8, background: '#E50914', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
              Enviar aviso geral
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

const inputStyle = {
  display: 'block', marginTop: 6, width: '100%', padding: '8px 12px',
  background: '#111', border: '1px solid #333', borderRadius: 6,
  color: '#fff', fontSize: 14,
};
