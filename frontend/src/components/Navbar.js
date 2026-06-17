'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getMe, logout } from '../lib/auth';
import api from '../lib/api';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('flixhome_token') ? { _pending: true } : null;
  });
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const debounce = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null));
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSug(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleSearchChange(value) {
    setSearch(value);
    clearTimeout(debounce.current);
    if (!value.trim() || value.length < 2) { setSuggestions([]); setShowSug(false); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(value)}&limit=6`);
        const all = [
          ...(res.data.movies || []).map(m => ({ ...m, _type: 'movie' })),
          ...(res.data.series || []).map(s => ({ ...s, _type: 'series' })),
        ].slice(0, 7);
        setSuggestions(all);
        setShowSug(all.length > 0);
      } catch { setSuggestions([]); setShowSug(false); }
    }, 300);
  }

  function handleSearch(e) {
    e.preventDefault();
    setShowSug(false);
    if (search.trim()) router.push(`/busca?q=${encodeURIComponent(search.trim())}`);
  }

  function pickSuggestion(item) {
    setShowSug(false);
    setSearch('');
    router.push(item._type === 'series' ? `/serie/${item.id}` : `/filme/${item.id}`);
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
        <div className={styles.searchWrap} ref={wrapRef}>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSug(true)}
              className={styles.searchInput}
              autoComplete="off"
            />
          </form>

          {showSug && (
            <div className={styles.suggestions}>
              {suggestions.map(item => (
                <button key={`${item._type}-${item.id}`} className={styles.sugItem} onClick={() => pickSuggestion(item)}>
                  {item.poster_url && (
                    <Image src={item.poster_url} alt={item.title} width={32} height={48} className={styles.sugPoster} />
                  )}
                  <div className={styles.sugInfo}>
                    <span className={styles.sugTitle}>{item.title}</span>
                    <span className={styles.sugMeta}>
                      {item._type === 'series' ? 'Série' : 'Filme'}
                      {(item.year || item.year_start) && ` · ${item.year || item.year_start}`}
                    </span>
                  </div>
                </button>
              ))}
              <button className={styles.sugAll} onClick={handleSearch}>
                Ver todos os resultados para "{search}"
              </button>
            </div>
          )}
        </div>

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
