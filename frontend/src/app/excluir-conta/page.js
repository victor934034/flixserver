'use client';
import { useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import styles from '../login/page.module.css';

export default function ExcluirContaPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!confirmed) { setError('Confirme que você entende que essa ação é permanente.'); return; }
    setLoading(true);
    try {
      const { data: loginData } = await axios.post('/api/auth/login', { email, password });
      await axios.delete('/api/auth/me', {
        headers: { Authorization: `Bearer ${loginData.token}` },
      });
      if (typeof window !== 'undefined') localStorage.removeItem('flixhome_token');
      setDone(true);
    } catch (err) {
      const msg = err.response?.data?.error;
      setError(msg && typeof msg === 'string' ? msg : 'Não foi possível excluir a conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.logo}>FLIXHOME</h1>
          <h2 className={styles.title}>Conta excluída</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Sua conta e todos os dados associados (histórico, lista, perfis) foram removidos
            permanentemente. Você já pode fechar esta página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.logo}>FLIXHOME</h1>
        <h2 className={styles.title}>Excluir conta</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1rem' }}>
          Entre com seu email e senha do FlixHome para confirmar a exclusão. Isso apaga
          permanentemente sua conta, histórico de reprodução, lista e perfis. Não pode ser desfeito.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={styles.input}
            required
          />
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem' }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ marginTop: 3 }} />
            Entendo que essa ação é permanente e não pode ser desfeita.
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.btn} disabled={loading} style={{ background: '#E50914' }}>
            {loading ? 'Excluindo...' : 'Excluir minha conta permanentemente'}
          </button>
        </form>

        <p className={styles.privacy}>
          Veja o que coletamos na nossa{' '}
          <Link href="/politica-de-privacidade">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  );
}
