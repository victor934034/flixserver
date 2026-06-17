'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { getMe, logout } from '../../lib/auth';
import styles from './page.module.css';

const PLAN_LABELS = { free: 'Gratuito', basic: 'Básico', premium: 'Premium', admin: 'Admin' };
const PLAN_COLORS = { free: '#888', basic: '#4a90e2', premium: '#e5b300', admin: '#e50914' };

export default function PerfilPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return (
    <>
      <Navbar />
      <main className={styles.main}><p className={styles.loading}>Carregando...</p></main>
    </>
  );

  if (!user) return null;

  const plan = user.plan || 'free';
  const initial = (user.name || user.email || '?')[0].toUpperCase();

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.avatar}>{initial}</div>

          <h1 className={styles.name}>{user.name || 'Usuário'}</h1>
          <p className={styles.email}>{user.email}</p>

          <span className={styles.planBadge} style={{ background: PLAN_COLORS[plan] }}>
            {PLAN_LABELS[plan] || plan}
          </span>

          {user.plan_expires_at && (
            <p className={styles.expiry}>
              Plano válido até {new Date(user.plan_expires_at).toLocaleDateString('pt-BR')}
            </p>
          )}

          <div className={styles.divider} />

          <div className={styles.links}>
            <a href="/minha-lista" className={styles.link}>
              <span className={styles.linkIcon}>🎬</span> Minha Lista
            </a>
            <a href="/continuar-assistindo" className={styles.link}>
              <span className={styles.linkIcon}>▶</span> Continuar Assistindo
            </a>
            {user.is_admin && (
              <a href="/admin" className={styles.link}>
                <span className={styles.linkIcon}>⚙</span> Painel Admin
              </a>
            )}
          </div>

          <div className={styles.divider} />

          <button className={styles.logoutBtn} onClick={logout}>Sair da Conta</button>
        </div>
      </main>
    </>
  );
}
