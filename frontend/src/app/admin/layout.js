'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getMe } from '../../lib/auth';
import api from '../../lib/api';
import styles from './layout.module.css';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/filmes', label: 'Filmes' },
  { href: '/admin/series', label: 'Séries' },
  { href: '/admin/upload', label: 'Upload' },
  { href: '/admin/upload-desenhos', label: 'Upload Desenhos' },
  { href: '/admin/importar', label: 'Importar TMDB' },
  { href: '/admin/usuarios', label: 'Usuários' },
  { href: '/admin/categorias', label: 'Categorias' },
  { href: '/admin/colecoes', label: 'Cronologias' },
  { href: '/admin/chat', label: 'Chat ao vivo', badge: 'chat' },
  { href: '/admin/sugestoes', label: 'Sugestões' },
  { href: '/admin/likes', label: 'Likes' },
  { href: '/admin/atividade', label: 'Atividade' },
  { href: '/admin/avatares', label: 'Avatares' },
  { href: '/admin/iptv', label: 'IPTV' },
  { href: '/admin/ajuda', label: 'Ajuda/FAQ' },
  { href: '/admin/configuracoes', label: 'Configurações' },
];

export default function AdminLayout({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const [chatUnread, setChatUnread] = useState(0);

  // Contador de mensagens não lidas do chat no menu
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const tick = () => api.get('/chat/admin/unread').then(r => { if (alive) setChatUnread(r.data?.unread || 0); }).catch(() => {});
    tick();
    const t = setInterval(tick, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [user, pathname]);

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
              {n.badge === 'chat' && chatUnread > 0 && (
                <span style={{ marginLeft: 8, background: '#E50914', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                  {chatUnread}
                </span>
              )}
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
