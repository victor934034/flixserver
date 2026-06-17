'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getMe, logout } from '../lib/auth';
import styles from './Navbar.module.css';

export default function Navbar() {
  // Lazy initializer: if a token exists, start with a placeholder so the nav
  // shows the "user area" layout immediately instead of flashing "Entrar" first.
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('flixhome_token') ? { _pending: true } : null;
  });
  const [search, setSearch] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null));

    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) router.push(`/busca?q=${encodeURIComponent(search.trim())}`);
  }

  const isLoggedIn = !!user;
  const isPending = user?._pending;

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
      <Link href="/" className={styles.logo}>FLIXHOME</Link>

      <div className={styles.links}>
        <Link href="/">Início</Link>
        <Link href="/filmes">Filmes</Link>
        <Link href="/series">Séries</Link>
        {isLoggedIn && <Link href="/minha-lista">Minha Lista</Link>}
      </div>

      <div className={styles.right}>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </form>

        {isLoggedIn ? (
          <div className={styles.userMenu}>
            {isPending
              ? <span className={styles.userNamePending} />
              : <Link href="/perfil" className={styles.userName}>{user.name?.split(' ')[0]}</Link>
            }
            {!isPending && user.is_admin && (
              <Link href="/admin" className={styles.adminLink}>Admin</Link>
            )}
            <button onClick={logout} className={styles.logoutBtn}>Sair</button>
          </div>
        ) : (
          <Link href="/login" className={styles.loginBtn}>Entrar</Link>
        )}
      </div>
    </nav>
  );
}
