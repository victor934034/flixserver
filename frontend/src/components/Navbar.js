'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getMe, logout } from '../lib/auth';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getMe().then(setUser).catch(() => {});
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) router.push(`/busca?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
      <Link href="/" className={styles.logo}>FLIXHOME</Link>

      <div className={styles.links}>
        <Link href="/">Início</Link>
        <Link href="/filmes">Filmes</Link>
        <Link href="/series">Séries</Link>
        {user && <Link href="/minha-lista">Minha Lista</Link>}
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

        {user ? (
          <div className={styles.userMenu}>
            <Link href="/perfil" className={styles.userName}>{user.name?.split(' ')[0]}</Link>
            {user.is_admin && <Link href="/admin" className={styles.adminLink}>Admin</Link>}
            <button onClick={logout} className={styles.logoutBtn}>Sair</button>
          </div>
        ) : (
          <Link href="/login" className={styles.loginBtn}>Entrar</Link>
        )}
      </div>
    </nav>
  );
}
