'use client';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import api from '../lib/api';
import d from './Dialog.module.css';
import s from './Extras.module.css';

const GENRES = ['Ação', 'Aventura', 'Animação', 'Comédia', 'Crime', 'Documentário', 'Drama', 'Fantasia', 'Ficção Científica', 'Mistério', 'Romance', 'Terror', 'Thriller'];

// "Surpreenda-me": sorteia um filme, com gênero opcional, pra quem não sabe o que ver.
export default function SurpriseButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [genre, setGenre] = useState('');
  const [movie, setMovie] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const drawn = useRef([]); // já sorteados, pra não repetir

  async function draw() {
    setBusy(true);
    setError('');
    const ask = () => api.get('/movies/surprise', { params: { genre: genre || undefined, exclude: drawn.current.join(',') || undefined } });
    try {
      let res;
      try { res = await ask(); } catch (e) {
        // acabaram os inéditos: recomeça a rodada
        if (e.response?.status !== 404 || !drawn.current.length) throw e;
        drawn.current = [];
        res = await ask();
      }
      drawn.current.push(res.data.id);
      setMovie(res.data);
    } catch (e) {
      setMovie(null);
      setError(e.response?.status === 404 ? 'Nenhum filme desse gênero ainda.' : 'Não deu para sortear. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  function pickGenre(g) {
    setGenre(g);
    setMovie(null);
    setError('');
    drawn.current = [];
  }

  return (
    <>
      <div className={s.surpriseBar}>
        <button type="button" className={s.surpriseBtn} onClick={() => { setOpen(true); pickGenre(''); }}>🎲 Surpreenda-me</button>
        <span>Não sabe o que ver? A gente sorteia um filme.</span>
      </div>
      {open && createPortal(
        <div className={d.overlay} onClick={() => setOpen(false)}>
          <div className={d.card} role="dialog" aria-modal="true" aria-label="Surpreenda-me" onClick={e => e.stopPropagation()}>
            <h2>🎲 Surpreenda-me</h2>
            <div className={s.chips}>
              {['', ...GENRES].map(g => (
                <button key={g || 'all'} type="button" aria-pressed={genre === g} className={`${s.chip} ${genre === g ? s.chipOn : ''}`} onClick={() => pickGenre(g)}>{g || 'Qualquer um'}</button>
              ))}
            </div>
            {movie && (
              <div className={s.result}>
                {movie.poster_url && <img src={movie.poster_url} alt="" />}
                <div>
                  <b>{movie.title}</b>
                  <small>{[movie.year, movie.rating ? `★ ${Number(movie.rating).toFixed(1)}` : null, (movie.genres || []).slice(0, 2).join(' · ')].filter(Boolean).join('  ·  ')}</small>
                  <p>{movie.synopsis}</p>
                </div>
              </div>
            )}
            {error && <span className={d.error}>{error}</span>}
            {movie && <button type="button" className={d.primary} onClick={() => { setOpen(false); router.push(`/filme/${movie.id}`); }}>Assistir este</button>}
            <button type="button" className={movie ? d.secondary : d.primary} onClick={draw} disabled={busy}>{busy ? 'Sorteando...' : movie ? 'Sortear outro' : 'Sortear'}</button>
            <button type="button" className={d.secondary} onClick={() => setOpen(false)}>Fechar</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
