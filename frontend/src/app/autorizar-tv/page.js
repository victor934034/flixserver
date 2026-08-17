'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import { getToken } from '../../lib/auth';
import styles from './page.module.css';

export default function AutorizarTvPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  async function confirm(e) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase().replace(/\s/g, '');
    if (trimmed.length !== 6) { setError('O código deve ter 6 caracteres.'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post(`/auth/tv/code/${trimmed}/confirm`);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.card}>
          <span className={styles.icon}>📺</span>

          {done ? (
            <>
              <h1 className={styles.title}>TV autorizada!</h1>
              <p className={styles.desc}>A TV entrará automaticamente em alguns segundos.</p>
              <button className={styles.btn} onClick={() => router.push('/perfil')}>Voltar</button>
            </>
          ) : (
            <>
              <h1 className={styles.title}>Autorizar TV</h1>
              <p className={styles.desc}>
                Na sua TV, abra o Flixhome e selecione <strong>Login via Código</strong>.<br />
                Digite aqui o código de 6 dígitos mostrado na tela.
              </p>

              <form onSubmit={confirm} className={styles.form}>
                <input
                  className={styles.input}
                  placeholder="AB1C2D"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  autoFocus
                />
                {error && <p className={styles.error}>{error}</p>}
                <button className={styles.btn} type="submit" disabled={!code.trim() || loading}>
                  {loading ? 'Conectando...' : 'Conectar TV'}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </>
  );
}
