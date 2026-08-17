'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import { getToken } from '../../lib/auth';
import styles from './page.module.css';

export default function SugestaoPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  function onQueryChange(v) {
    setQuery(v);
    if (selected) setSelected(null);
    clearTimeout(timerRef.current);
    if (v.trim().length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(() => doSearch(v.trim()), 400);
  }

  async function doSearch(q) {
    setSearching(true);
    try {
      const { data } = await api.get('/search', { params: { q, limit: 8 } });
      const items = [
        ...(data.movies || []).map(m => ({ ...m, type: 'movie', displayYear: m.year })),
        ...(data.series || []).map(s => ({ ...s, type: 'series', displayYear: s.year_start })),
      ];
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function selectItem(item) {
    setSelected(item);
    setQuery(item.title);
    setResults([]);
  }

  async function submit(e) {
    e.preventDefault();
    const title = selected?.title || query.trim();
    if (!title) { setError('Informe o título do filme ou série.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/suggestions', {
        title,
        original_title: selected?.original_title || null,
        year: selected?.displayYear || null,
        type: selected?.type || null,
        poster_url: selected?.poster_url || null,
        tmdb_id: selected?.tmdb_id || null,
        message: message.trim() || null,
      });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao enviar sugestão.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.card}>
          {done ? (
            <div className={styles.doneWrap}>
              <span className={styles.doneIcon}>✓</span>
              <h1 className={styles.title}>Sugestão enviada!</h1>
              <p className={styles.subtitle}>Obrigado — vamos avaliar a inclusão de "{selected?.title || query}".</p>
              <button className={styles.btnSave} onClick={() => { setDone(false); setQuery(''); setSelected(null); setMessage(''); }}>
                Enviar outra sugestão
              </button>
            </div>
          ) : (
            <>
              <h1 className={styles.title}>Sugerir Conteúdo</h1>
              <p className={styles.subtitle}>Não achou um filme ou série? Sugira aqui.</p>

              <form onSubmit={submit} className={styles.form}>
                <div className={styles.searchWrap}>
                  <input
                    className={styles.input}
                    placeholder="Título do filme ou série..."
                    value={query}
                    onChange={e => onQueryChange(e.target.value)}
                    autoComplete="off"
                  />
                  {searching && <span className={styles.searchHint}>Buscando...</span>}
                  {results.length > 0 && (
                    <div className={styles.results}>
                      {results.map(item => (
                        <button
                          type="button"
                          key={`${item.type}-${item.id}`}
                          className={styles.resultItem}
                          onClick={() => selectItem(item)}
                        >
                          {item.poster_url && <img src={item.poster_url} alt="" className={styles.resultPoster} />}
                          <span>
                            <span className={styles.resultTitle}>{item.title}</span>
                            <span className={styles.resultMeta}>
                              {item.type === 'series' ? 'Série' : 'Filme'}{item.displayYear ? ` · ${item.displayYear}` : ''}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selected && (
                    <div className={styles.selectedTag}>
                      Selecionado: <strong>{selected.title}</strong>
                      <button type="button" onClick={() => { setSelected(null); setQuery(''); }}>✕</button>
                    </div>
                  )}
                </div>

                <textarea
                  className={styles.textarea}
                  placeholder="Alguma observação? (opcional)"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  maxLength={500}
                />

                {error && <p className={styles.error}>{error}</p>}

                <button type="submit" className={styles.btnSave} disabled={submitting}>
                  {submitting ? 'Enviando...' : 'Enviar Sugestão'}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </>
  );
}
