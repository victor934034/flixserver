'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import api from '../lib/api';
import s from './Dialog.module.css';

// "Assistir juntos": a pessoa escolhe entre criar uma sala deste título ou entrar numa pelo código.
export default function TogetherButton({ contentType, contentId, title, poster, className, style, label = '👥 Assistir juntos' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const close = () => { setOpen(false); setCode(''); setError(''); setBusy(''); };

  async function create() {
    if (busy) return;
    setBusy('create'); setError('');
    try {
      const { data } = await api.post('/together/rooms', { content_type: contentType, content_id: contentId, title, poster_url: poster });
      router.push(`/juntos/${data.code}?host=1`);
    } catch (e) {
      setError(e.response?.data?.error || 'Não foi possível criar a sala.');
      setBusy('');
    }
  }

  async function join(e) {
    e.preventDefault();
    if (busy || code.length !== 6) return;
    setBusy('join'); setError('');
    try {
      await api.get(`/together/rooms/${code}`);
      router.push(`/juntos/${code}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Sala não encontrada ou encerrada.');
      setBusy('');
    }
  }

  return (
    <>
      <button type="button" className={className} style={style} onClick={() => setOpen(true)}>{label}</button>
      {open && createPortal(
        <div className={s.overlay} onClick={close}>
          <div className={s.card} role="dialog" aria-modal="true" aria-label="Assistir juntos" onClick={e => e.stopPropagation()}>
            <h2>Assistir juntos</h2>
            <p>{title}</p>
            <button type="button" className={s.primary} onClick={create} disabled={!!busy}>{busy === 'create' ? 'Criando…' : 'Criar uma sala'}</button>
            <span className={s.divider}>ou entre na sala de um amigo</span>
            <form onSubmit={join} className={s.form}>
              <input className={s.input} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="CÓDIGO" aria-label="Código da sala" />
              <button type="submit" className={s.secondary} disabled={!!busy || code.length !== 6}>{busy === 'join' ? 'Procurando…' : 'Entrar com o código'}</button>
            </form>
            {error && <span className={s.error}>{error}</span>}
            <button type="button" className={s.secondary} onClick={close}>Cancelar</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
