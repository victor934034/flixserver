'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import styles from '../filmes/novo/page.module.css';

export default function Configuracoes() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/settings').then(r => setSettings(r.data)).finally(() => setLoading(false));
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
      // Usa o endpoint de novo filme com is_active: false para só disparar o push manualmente
      await api.post('/admin/notify', { title, body });
      setMsg('Notificação enviada!');
    } catch {
      setMsg('Erro ao enviar notificação');
    } finally {
      setSaving('');
    }
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>;

  const subEnabled = settings.subscription_enabled === 'true';

  return (
    <div>
      <h1 className={styles.heading}>Configurações</h1>

      <section style={{ marginBottom: 40 }}>
        <h3 style={{ color: '#fff', marginBottom: 16 }}>Assinatura</h3>
        <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 24, border: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p style={{ color: '#fff', fontWeight: 600, margin: 0 }}>
                Sistema de assinatura: <span style={{ color: subEnabled ? '#4caf50' : '#ff6b6b' }}>{subEnabled ? 'ATIVADO' : 'DESATIVADO'}</span>
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
