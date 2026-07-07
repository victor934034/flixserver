'use client';
import { useEffect, useRef, useState } from 'react';
import api from '../../../lib/api';
import styles from '../filmes/novo/page.module.css';

const DEFAULT_PLANS = [
  { id: 'monthly_2',   name: 'Mensal · 2 Telas',     price: 9.90,   promo_price: 2.90, duration_days: 30,  active: true,  badge: null,           description: 'Acesso por 1 mês',       highlight: false, max_streams: 2 },
  { id: 'monthly_3',   name: 'Mensal · 3 Telas',     price: 14.90,  promo_price: 4.90, duration_days: 30,  active: true,  badge: null,           description: 'Acesso por 1 mês',       highlight: false, max_streams: 3 },
  { id: 'monthly_5',   name: 'Mensal · 5 Telas',     price: 19.90,  promo_price: 6.90, duration_days: 30,  active: true,  badge: null,           description: 'Acesso por 1 mês',       highlight: false, max_streams: 5 },
  { id: 'quarterly_2', name: 'Trimestral · 2 Telas', price: 19.90,  promo_price: null, duration_days: 90,  active: true,  badge: null,           description: 'Equivale a R$ 6,63/mês', highlight: false, max_streams: 2 },
  { id: 'quarterly_3', name: 'Trimestral · 3 Telas', price: 29.90,  promo_price: null, duration_days: 90,  active: true,  badge: 'MAIS POPULAR', description: 'Equivale a R$ 9,97/mês', highlight: true,  max_streams: 3 },
  { id: 'quarterly_5', name: 'Trimestral · 5 Telas', price: 44.90,  promo_price: null, duration_days: 90,  active: true,  badge: null,           description: 'Equivale a R$ 14,97/mês',highlight: false, max_streams: 5 },
  { id: 'yearly_2',    name: 'Anual · 2 Telas',      price: 49.90,  promo_price: null, duration_days: 365, active: true,  badge: null,           description: 'Equivale a R$ 4,16/mês', highlight: false, max_streams: 2 },
  { id: 'yearly_3',    name: 'Anual · 3 Telas',      price: 79.90,  promo_price: null, duration_days: 365, active: true,  badge: null,           description: 'Equivale a R$ 6,66/mês', highlight: false, max_streams: 3 },
  { id: 'yearly_5',    name: 'Anual · 5 Telas',      price: 119.90, promo_price: null, duration_days: 365, active: true,  badge: 'MELHOR CUSTO', description: 'Equivale a R$ 9,99/mês', highlight: true,  max_streams: 5 },
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

  const [faststartMsg, setFaststartMsg] = useState('');
  const [faststartRunning, setFaststartRunning] = useState(false);
  const [faststartProgress, setFaststartProgress] = useState(null);
  const faststartPollRef = useRef(null);

  const [hlsMsg, setHlsMsg] = useState('');
  const [hlsRunning, setHlsRunning] = useState(false);
  const [hlsProgress, setHlsProgress] = useState(null);
  const hlsPollRef = useRef(null);

  const [pushTokenCount, setPushTokenCount] = useState(null);

  const [hlsCleanScan, setHlsCleanScan] = useState(null);   // { count, display }
  const [hlsCleanRunning, setHlsCleanRunning] = useState(false);
  const [hlsCleanMsg, setHlsCleanMsg] = useState('');
  const [hlsCleanProgress, setHlsCleanProgress] = useState(null);
  const hlsCleanPollRef = useRef(null);
  const [hlsCleanConfirm, setHlsCleanConfirm] = useState(false);

  useEffect(() => {
    api.get('/settings').then(r => setSettings(r.data)).finally(() => setLoading(false));
    api.get('/payments/plans/all')
      .then(r => setPlans(r.data?.length ? r.data : DEFAULT_PLANS))
      .catch(() => setPlans(DEFAULT_PLANS))
      .finally(() => setPlansLoading(false));
    api.get('/admin/push-tokens/count')
      .then(r => setPushTokenCount(r.data))
      .catch(() => {});
    api.get('/admin/hls-cleanup/scan')
      .then(r => setHlsCleanScan(r.data))
      .catch(() => {});
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
      const { data } = await api.post('/admin/notify', { title, body });
      const count = data?.sent ?? 0;
      if (count === 0) {
        setMsg('⚠️ Enviado, mas nenhum usuário tem token de notificação (instale o APK mais recente e abra o app)');
      } else {
        setMsg(`✅ Notificação enviada para ${count} dispositivo(s)!`);
      }
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

      {/* ── MANUTENÇÃO ── */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ color: '#fff', marginBottom: 16 }}>Manutenção</h3>
        <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 24, border: '1px solid #2a2a2a' }}>
          <p style={{ color: '#fff', fontWeight: 600, margin: '0 0 4px' }}>Corrigir faststart de MP4s</p>
          <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>
            Aplica <code style={{ background: '#111', padding: '1px 5px', borderRadius: 4 }}>-movflags +faststart</code> em todos os arquivos .mp4 do banco —
            move o moov atom para o início do arquivo para que o vídeo comece a reproduzir instantaneamente.
            O processo roda em background no servidor; acompanhe os logs do EasePanel.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <button
                disabled={faststartRunning}
                onClick={async () => {
                  setFaststartRunning(true);
                  setFaststartMsg('');
                  setFaststartProgress(null);
                  clearInterval(faststartPollRef.current);
                  try {
                    const r = await api.post('/upload/batch-fix-faststart', {}, { timeout: 30000 });
                    if (!r.data.jobId) {
                      setFaststartMsg(r.data.message || '✓ Nenhum MP4 para corrigir.');
                      setFaststartRunning(false);
                      return;
                    }
                    const { jobId } = r.data;
                    setFaststartProgress({ total: r.data.total, done: 0, errors: 0, running: true, lastFile: '', skipped: r.data.skipped || 0 });
                    faststartPollRef.current = setInterval(async () => {
                      try {
                        const s = await api.get(`/upload/batch-status?jobId=${jobId}`);
                        setFaststartProgress(s.data);
                        if (!s.data.running) {
                          clearInterval(faststartPollRef.current);
                          setFaststartRunning(false);
                          const sk = s.data.skipped ? ` (${s.data.skipped} já prontos)` : '';
                          setFaststartMsg(
                            s.data.errors === 0
                              ? `✓ ${s.data.done} arquivo(s) corrigido(s)${sk}.`
                              : `${s.data.done} corrigido(s), ${s.data.errors} erro(s)${sk}${s.data.lastError ? ': ' + s.data.lastError : ' — veja os logs.'}`
                          );
                        }
                      } catch {
                        clearInterval(faststartPollRef.current);
                        setFaststartRunning(false);
                        setFaststartMsg('Erro ao verificar progresso. Veja os logs do servidor.');
                      }
                    }, 3000);
                  } catch (e) {
                    setFaststartMsg('Erro: ' + (e.response?.data?.error || e.message));
                    setFaststartRunning(false);
                  }
                }}
                style={{
                  padding: '10px 24px', borderRadius: 8,
                  background: faststartRunning ? '#333' : '#1565c0',
                  color: '#fff', border: 'none', fontWeight: 700, fontSize: 14,
                  cursor: faststartRunning ? 'not-allowed' : 'pointer',
                }}>
                {faststartRunning ? 'Processando...' : 'Corrigir todos os MP4s'}
              </button>
              {faststartMsg && (
                <span style={{ color: faststartMsg.startsWith('Erro') ? '#ff6b6b' : '#4caf50', fontSize: 13 }}>
                  {faststartMsg}
                </span>
              )}
            </div>

            {faststartProgress && faststartProgress.running && (
              <div style={{ background: '#111', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                    {faststartProgress.done} / {faststartProgress.total} arquivos
                    {faststartProgress.errors > 0 && (
                      <span style={{ color: '#ff6b6b', marginLeft: 8 }}>({faststartProgress.errors} erros)</span>
                    )}
                  </span>
                  <span style={{ color: '#888', fontSize: 12 }}>
                    {Math.round((faststartProgress.done / faststartProgress.total) * 100)}%
                  </span>
                </div>
                <div style={{ background: '#222', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4, background: '#1565c0',
                    width: `${Math.round((faststartProgress.done / faststartProgress.total) * 100)}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                {faststartProgress.lastFile && (
                  <p style={{ color: '#555', fontSize: 11, margin: '6px 0 0', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {faststartProgress.lastFile}
                  </p>
                )}
                {faststartProgress.lastError && (
                  <p style={{ color: '#ff6b6b', fontSize: 11, margin: '4px 0 0', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    Último erro: {faststartProgress.lastError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── HLS (abertura em < 1s) ── */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ color: '#fff', marginBottom: 16 }}>HLS — Abertura instantânea</h3>
        <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 24, border: '1px solid #2a2a2a' }}>
          <p style={{ color: '#fff', fontWeight: 600, margin: '0 0 4px' }}>Gerar HLS para todos os vídeos</p>
          <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>
            Converte cada vídeo em formato HLS (M3U8 + segmentos .ts). O player começa a reproduzir em{' '}
            <strong style={{ color: '#fff' }}>&lt; 1 segundo</strong> porque só precisa baixar o primeiro segmento (4s ≈ 500KB).
            Roda em background — pode demorar horas para bibliotecas grandes.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <button
                disabled={hlsRunning}
                onClick={async () => {
                  setHlsRunning(true);
                  setHlsMsg('');
                  setHlsProgress(null);
                  clearInterval(hlsPollRef.current);
                  try {
                    const r = await api.post('/upload/batch-generate-hls', {}, { timeout: 30000 });
                    if (!r.data.jobId) {
                      setHlsMsg(r.data.message || '✓ Nenhum vídeo encontrado.');
                      setHlsRunning(false);
                      return;
                    }
                    const { jobId } = r.data;
                    setHlsProgress({ total: r.data.total, done: 0, errors: 0, running: true, lastFile: '' });
                    hlsPollRef.current = setInterval(async () => {
                      try {
                        const s = await api.get(`/upload/batch-status?jobId=${jobId}`);
                        setHlsProgress(s.data);
                        if (!s.data.running) {
                          clearInterval(hlsPollRef.current);
                          setHlsRunning(false);
                          setHlsMsg(
                            s.data.errors === 0
                              ? `✓ ${s.data.done} vídeo(s) convertido(s) para HLS.`
                              : `${s.data.done} convertido(s), ${s.data.errors} erro(s)${s.data.lastError ? ': ' + s.data.lastError : ' — veja os logs.'}`
                          );
                        }
                      } catch {
                        clearInterval(hlsPollRef.current);
                        setHlsRunning(false);
                        setHlsMsg('Erro ao verificar progresso.');
                      }
                    }, 5000);
                  } catch (e) {
                    setHlsMsg('Erro: ' + (e.response?.data?.error || e.message));
                    setHlsRunning(false);
                  }
                }}
                style={{
                  padding: '10px 24px', borderRadius: 8,
                  background: hlsRunning ? '#333' : '#1b5e20',
                  color: '#fff', border: 'none', fontWeight: 700, fontSize: 14,
                  cursor: hlsRunning ? 'not-allowed' : 'pointer',
                }}>
                {hlsRunning ? 'Gerando HLS...' : '⚡ Gerar HLS para todos'}
              </button>
              {hlsMsg && (
                <span style={{ color: hlsMsg.startsWith('Erro') ? '#ff6b6b' : '#4caf50', fontSize: 13 }}>
                  {hlsMsg}
                </span>
              )}
            </div>

            {hlsProgress && hlsProgress.running && (
              <div style={{ background: '#111', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                    {hlsProgress.done} / {hlsProgress.total} vídeos
                    {hlsProgress.errors > 0 && (
                      <span style={{ color: '#ff6b6b', marginLeft: 8 }}>({hlsProgress.errors} erros)</span>
                    )}
                  </span>
                  <span style={{ color: '#888', fontSize: 12 }}>
                    {Math.round((hlsProgress.done / hlsProgress.total) * 100)}%
                  </span>
                </div>
                <div style={{ background: '#222', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4, background: '#1b5e20',
                    width: `${Math.round((hlsProgress.done / hlsProgress.total) * 100)}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                {hlsProgress.lastFile && (
                  <p style={{ color: '#555', fontSize: 11, margin: '6px 0 0', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {hlsProgress.lastFile}
                  </p>
                )}
                {hlsProgress.lastError && (
                  <p style={{ color: '#ff6b6b', fontSize: 11, margin: '4px 0 0', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    Último erro: {hlsProgress.lastError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── LIMPEZA HLS ── */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ color: '#fff', marginBottom: 16 }}>Limpeza de Arquivos HLS</h3>
        <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 24, border: '1px solid #2a2a2a' }}>
          <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>
            Arquivos <strong style={{ color: '#fff' }}>.ts</strong> e <strong style={{ color: '#fff' }}>.m3u8</strong> do HLS ocupam muito espaço no Backblaze.
            Se os vídeos já têm faststart, esses arquivos são desnecessários e podem ser deletados.
          </p>

          {/* Resultado do scan */}
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 8, background: '#111', border: '1px solid #333' }}>
            {hlsCleanScan === null
              ? <span style={{ color: '#666', fontSize: 13 }}>Escaneando bucket...</span>
              : hlsCleanScan.count === 0
                ? <span style={{ color: '#4caf50', fontSize: 13 }}>✅ Nenhum arquivo HLS encontrado — bucket já está limpo.</span>
                : <span style={{ color: '#ff9800', fontSize: 13 }}>
                    ⚠️ <strong style={{ color: '#fff' }}>{hlsCleanScan.count.toLocaleString()}</strong> arquivos HLS encontrados ocupando{' '}
                    <strong style={{ color: '#E50914' }}>{hlsCleanScan.display}</strong> no Backblaze.
                  </span>
            }
          </div>

          {/* Botões */}
          {hlsCleanScan?.count > 0 && !hlsCleanRunning && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <button
                onClick={() => { setHlsCleanScan(null); api.get('/admin/hls-cleanup/scan').then(r => setHlsCleanScan(r.data)).catch(() => {}); }}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#222', color: '#aaa', border: '1px solid #333', cursor: 'pointer', fontSize: 13 }}>
                🔄 Atualizar contagem
              </button>
              {!hlsCleanConfirm
                ? <button
                    onClick={() => setHlsCleanConfirm(true)}
                    style={{ padding: '10px 20px', borderRadius: 8, background: '#7b1fa2', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                    🗑️ Deletar todos os arquivos HLS
                  </button>
                : <>
                    <span style={{ color: '#ff6b6b', fontSize: 13, fontWeight: 600 }}>Tem certeza? Isso não pode ser desfeito.</span>
                    <button
                      onClick={async () => {
                        setHlsCleanConfirm(false);
                        setHlsCleanRunning(true);
                        setHlsCleanMsg('');
                        setHlsCleanProgress(null);
                        clearInterval(hlsCleanPollRef.current);
                        try {
                          const { data } = await api.post('/admin/hls-cleanup/delete');
                          if (!data.jobId) {
                            setHlsCleanMsg('Nenhum arquivo encontrado.');
                            setHlsCleanRunning(false);
                            return;
                          }
                          hlsCleanPollRef.current = setInterval(async () => {
                            try {
                              const s = await api.get(`/admin/hls-cleanup/status?jobId=${data.jobId}`);
                              setHlsCleanProgress(s.data);
                              if (!s.data.running) {
                                clearInterval(hlsCleanPollRef.current);
                                setHlsCleanRunning(false);
                                setHlsCleanScan({ count: 0, display: '0 MB' });
                                setHlsCleanMsg(
                                  s.data.errors === 0
                                    ? `✅ ${s.data.done.toLocaleString()} arquivo(s) deletados com sucesso!`
                                    : `${s.data.done.toLocaleString()} deletados, ${s.data.errors} erros.`
                                );
                              }
                            } catch { clearInterval(hlsCleanPollRef.current); setHlsCleanRunning(false); }
                          }, 2000);
                        } catch (e) {
                          setHlsCleanMsg('Erro: ' + (e.response?.data?.error || e.message));
                          setHlsCleanRunning(false);
                        }
                      }}
                      style={{ padding: '10px 20px', borderRadius: 8, background: '#c62828', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                      ✅ Sim, deletar tudo
                    </button>
                    <button onClick={() => setHlsCleanConfirm(false)}
                      style={{ padding: '10px 16px', borderRadius: 8, background: '#222', color: '#aaa', border: '1px solid #333', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </>
              }
            </div>
          )}

          {/* Mensagem final */}
          {hlsCleanMsg && !hlsCleanRunning && (
            <p style={{ color: hlsCleanMsg.startsWith('✅') ? '#4caf50' : '#ff6b6b', fontSize: 13, margin: '8px 0 0' }}>
              {hlsCleanMsg}
            </p>
          )}

          {/* Barra de progresso durante deleção */}
          {hlsCleanProgress && hlsCleanRunning && (
            <div style={{ background: '#111', borderRadius: 8, padding: '12px 16px', marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                  Deletando... {hlsCleanProgress.done.toLocaleString()} / {hlsCleanProgress.total.toLocaleString()}
                  {hlsCleanProgress.errors > 0 && <span style={{ color: '#ff6b6b', marginLeft: 8 }}>({hlsCleanProgress.errors} erros)</span>}
                </span>
                <span style={{ color: '#888', fontSize: 12 }}>
                  {Math.round((hlsCleanProgress.done / hlsCleanProgress.total) * 100)}%
                </span>
              </div>
              <div style={{ background: '#222', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4, background: '#7b1fa2',
                  width: `${Math.round((hlsCleanProgress.done / hlsCleanProgress.total) * 100)}%`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              {hlsCleanProgress.lastFile && (
                <p style={{ color: '#555', fontSize: 11, margin: '6px 0 0', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {hlsCleanProgress.lastFile}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── NOTIFICAÇÕES ── */}
      <section>
        <h3 style={{ color: '#fff', marginBottom: 16 }}>Notificações Push</h3>
        <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 24, border: '1px solid #2a2a2a' }}>
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: pushTokenCount === null ? '#111' : pushTokenCount?.valid > 0 ? '#0d2a0d' : '#2a1a0d', border: '1px solid #333', fontSize: 13 }}>
            {pushTokenCount === null
              ? <span style={{ color: '#666' }}>Carregando tokens...</span>
              : pushTokenCount.valid === 0
                ? <span style={{ color: '#ff9800' }}>⚠️ Nenhum dispositivo registrado — instale o APK mais recente e abra o app para registrar.</span>
                : <span style={{ color: '#4caf50' }}>✅ {pushTokenCount.valid} dispositivo(s) com notificação ativa</span>
            }
          </div>
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
