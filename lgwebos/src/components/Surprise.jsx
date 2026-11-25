import React, { useEffect, useRef, useState } from 'react';
import { KEY } from '../hooks/useNav.js';
import api from '../api/index.js';

const GENRES = ['', 'Ação', 'Aventura', 'Animação', 'Comédia', 'Crime', 'Documentário', 'Drama', 'Fantasia', 'Ficção Científica', 'Mistério', 'Romance', 'Terror', 'Thriller'];

// "Surpreenda-me": sorteia um filme com gênero opcional. Enquanto está aberto,
// o controle remoto é só dele (captura as teclas antes da Home).
export default function Surprise({ onClose, onPick }) {
  const [genreIdx, setGenreIdx] = useState(0);
  const [area, setArea] = useState('genres'); // 'genres' | 'buttons'
  const [btn, setBtn] = useState(0);
  const [movie, setMovie] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const drawn = useRef([]);

  const buttons = movie ? ['Ver este', 'Sortear outro', 'Fechar'] : ['Sortear', 'Fechar'];

  async function draw() {
    if (busy) return;
    setBusy(true); setError('');
    const genre = GENRES[genreIdx];
    const ask = () => api.get('/api/movies/surprise', { params: { genre: genre || undefined, exclude: drawn.current.join(',') || undefined } });
    try {
      let res;
      try { res = await ask(); } catch (e) {
        // acabaram os inéditos: recomeça a rodada
        if (!e.response || e.response.status !== 404 || !drawn.current.length) throw e;
        drawn.current = [];
        res = await ask();
      }
      drawn.current.push(res.data.id);
      setMovie(res.data);
      setBtn(0);
    } catch (e) {
      setMovie(null);
      setBtn(0);
      setError(e.response && e.response.status === 404 ? 'Nenhum filme desse gênero ainda.' : 'Não deu para sortear. Tente de novo.');
    }
    setBusy(false);
  }

  function activate(label) {
    if (label === 'Fechar') onClose();
    else if (label === 'Ver este') { onClose(); onPick(movie); }
    else draw();
  }

  function pickGenre(i) {
    setGenreIdx(i); setMovie(null); setError(''); setBtn(0);
    drawn.current = [];
  }

  const ref = useRef(null);
  ref.current = (e) => {
    const k = e.keyCode;
    const back = k === KEY.BACK || k === KEY.BACKSPACE;
    if (!back && [KEY.LEFT, KEY.RIGHT, KEY.UP, KEY.DOWN, KEY.ENTER].indexOf(k) < 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (back) { onClose(); return; }
    if (area === 'genres') {
      if (k === KEY.LEFT) pickGenre(Math.max(0, genreIdx - 1));
      if (k === KEY.RIGHT) pickGenre(Math.min(GENRES.length - 1, genreIdx + 1));
      if (k === KEY.DOWN || k === KEY.ENTER) { setArea('buttons'); setBtn(0); }
    } else {
      if (k === KEY.UP) setArea('genres');
      if (k === KEY.LEFT) setBtn(b => Math.max(0, b - 1));
      if (k === KEY.RIGHT) setBtn(b => Math.min(buttons.length - 1, b + 1));
      if (k === KEY.ENTER && !e.repeat) activate(buttons[btn]);
    }
  };

  useEffect(() => {
    const fn = (e) => ref.current(e);
    // o OK que abriu o painel ainda está sendo processado: começa a ouvir no próximo ciclo
    const t = setTimeout(() => document.addEventListener('keydown', fn, true), 0);
    return () => { clearTimeout(t); document.removeEventListener('keydown', fn, true); };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9970, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1100, padding: 40, borderRadius: 20, background: '#141414', border: '1px solid #2a2a2a', color: '#fff' }}>
        <div style={{ fontSize: 34, fontWeight: 900, marginBottom: 20 }}>🎲 Surpreenda-me</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
          {GENRES.map((g, i) => (
            <div key={g || 'all'} onClick={() => pickGenre(i)} style={{
              padding: '10px 18px', borderRadius: 24, fontSize: 18, cursor: 'pointer',
              background: genreIdx === i ? '#fff' : 'rgba(255,255,255,0.06)', color: genreIdx === i ? '#000' : '#ccc',
              fontWeight: genreIdx === i ? 800 : 500,
              border: '3px solid ' + (area === 'genres' && genreIdx === i ? '#e50914' : 'transparent'),
            }}>{g || 'Qualquer um'}</div>
          ))}
        </div>

        {movie && (
          <div style={{ display: 'flex', gap: 24, marginBottom: 26 }}>
            {movie.poster_url && <img src={movie.poster_url} alt="" style={{ width: 180, height: 270, objectFit: 'cover', borderRadius: 10 }} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 30, fontWeight: 800 }}>{movie.title}</div>
              <div style={{ color: '#aaa', fontSize: 18, margin: '8px 0 14px' }}>
                {[movie.year, movie.rating ? '★ ' + Number(movie.rating).toFixed(1) : null, (movie.genres || []).slice(0, 2).join(' · ')].filter(Boolean).join('   ·   ')}
              </div>
              <div style={{ color: '#ddd', fontSize: 19, lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' }}>{movie.synopsis}</div>
            </div>
          </div>
        )}
        {error && <div style={{ color: '#f87171', fontSize: 20, marginBottom: 20 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 16 }}>
          {buttons.map((label, i) => (
            <div key={label} onClick={() => activate(label)} style={{
              padding: '15px 38px', borderRadius: 10, fontSize: 21, fontWeight: 800, cursor: 'pointer',
              background: i === 0 ? '#e50914' : 'rgba(255,255,255,0.1)',
              border: '3px solid ' + (area === 'buttons' && btn === i ? '#fff' : 'transparent'),
            }}>{busy && label.indexOf('Sortear') === 0 ? 'Sorteando...' : label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
