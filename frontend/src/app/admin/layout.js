'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getMe } from '../../lib/auth';
import styles from './layout.module.css';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/filmes', label: 'Filmes' },
  { href: '/admin/series', label: 'Séries' },
  { href: '/admin/upload', label: 'Upload' },
  { href: '/admin/importar', label: 'Importar TMDB' },
  { href: '/admin/usuarios', label: 'Usuários' },
  { href: '/admin/categorias', label: 'Categorias' },
  { href: '/admin/sugestoes', label: 'Sugestões' },
  { href: '/admin/avatares', label: 'Avatares' },
  { href: '/admin/configuracoes', label: 'Configurações' },
];

export default function AdminLayout({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    getMe()
      .then(u => {
        if (!u.is_admin) { router.replace('/'); return; }
        setUser(u);
      })
      .catch(() => router.replace('/login'))
      .finally(() => setChecking(false));
  }, [router]);

  if (checking) return <div className={styles.loading}>Verificando acesso...</div>;
  if (!user) return null;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>FLIXHOME<br /><span>Admin</span></div>
        <nav className={styles.nav}>
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className={`${styles.navLink} ${pathname === n.href ? styles.active : ''}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className={styles.userInfo}>
          <span>{user.name}</span>
          <Link href="/" className={styles.siteLink}>Ver site</Link>
        </div>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
