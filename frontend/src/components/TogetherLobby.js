'use client';
import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import s from './TogetherLobby.module.css';

const COLORS = ['#7c3aed', '#0ea5e9', '#f97316', '#e11d48', '#14b8a6', '#eab308', '#6366f1', '#84cc16'];
const colorOf = (id) => COLORS[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const initials = (n) => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

// Sala de espera: pessoas que entram pelo link aparecem aqui (com foto), conversa e botão de iniciar.
export default function TogetherLobby({ tg, code, onLeave }) {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [sent, setSent] = useState({});
  const [showInvite, setShowInvite] = useState(false);
  const fileRef = useRef(null);
  const endRef = useRef(null);

  const link = typeof window !== 'undefined' ? `${window.location.origin}/juntos/${code}` : '';
  const me = tg.members.find(m => m.id === tg.you?.id);
  const host = !!tg.you?.host;

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [tg.messages.length]);
  useEffect(() => {
    if (q.trim().length < 3) { setFound([]); return; }
    const t = setTimeout(() => api.get('/together/users', { params: { q } }).then(r => setFound(r.data || [])).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q]);

  const copy = () => { navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  const send = (e) => { e.preventDefault(); if (!text.trim()) return; tg.sendChat(text); setText(''); };
  const invite = async (u) => { try { await api.post(`/together/rooms/${code}/invite`, { user_id: u.id }); setSent(x => ({ ...x, [u.id]: true })); } catch {} };

  async function onPhoto(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setPhotoErr('');
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setPhotoErr('Use uma imagem JPG, PNG ou WEBP.');
    if (f.size > 2 * 1024 * 1024) return setPhotoErr('A foto pode ter no máximo 2 MB.');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', f);
      const { data } = await api.post('/together/avatar', form);
      tg.updateAvatar(data.avatar_url);
    } catch (err) { setPhotoErr(err.response?.data?.error || 'Não foi possível enviar a foto.'); }
    setUploading(false);
  }
  async function removePhoto() { try { await api.delete('/together/avatar'); tg.updateAvatar(null); } catch {} }

  const room = tg.room || {};
  return (
    <main className={s.page}>
      <div className={s.head}>
        <button className={s.back} onClick={onLeave} aria-label="Sair da sala">‹</button>
        <h1>Sala de espera</h1>
        <span className={s.chip}><i />{tg.members.length} na sala</span>
      </div>

      <div className={s.grid}>
        <section className={s.col}>
          <div className={s.card}>
            {room.poster_url ? <img className={s.poster} src={room.poster_url} alt="" /> : <div className={s.poster} />}
            <div>
              <span className={s.kicker}>VOCÊS VÃO ASSISTIR</span>
              <h2>{room.title}</h2>
              <p className={s.muted}>Código <b className={s.code}>{code}</b></p>
            </div>
          </div>

          <div className={s.card2}>
            <span className={s.label}>CONVIDE PELO LINK</span>
            <div className={s.linkRow}>
              <span className={s.link}>{link}</span>
              <button className={`${s.copy} ${copied ? s.copied : ''}`} onClick={copy}>{copied ? '✓ Copiado!' : 'Copiar'}</button>
            </div>
          </div>

          <div className={s.card2}>
            <span className={s.label}>NA SALA · {tg.members.length}</span>
            <div className={s.people}>
              {tg.members.map(m => {
                const mine = m.id === tg.you?.id;
                return (
                  <div key={m.id} className={s.av}>
                    <div className={s.circleWrap}>
                      <div className={s.circle} style={{ background: colorOf(m.userId) }}>
                        {m.avatar ? <img src={m.avatar} alt="" /> : initials(m.name)}
                      </div>
                      {mine && <button className={s.cam} onClick={() => fileRef.current?.click()} aria-label="Trocar minha foto" disabled={uploading}>{uploading ? '…' : '📷'}</button>}
                    </div>
                    <span>{mine ? 'Você' : m.name.split(' ')[0]}</span>
                    {m.host && <small>Anfitrião</small>}
                  </div>
                );
              })}
              <button className={s.add} onClick={() => setShowInvite(v => !v)}><div>+</div><span>Convidar</span></button>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPhoto} />
            <div className={s.photoRow}>
              <button className={s.ghost} onClick={() => fileRef.current?.click()}>{me?.avatar ? 'Trocar minha foto' : 'Colocar uma foto'}</button>
              {me?.avatar && <button className={s.ghost} onClick={removePhoto}>Remover</button>}
              {photoErr && <span className={s.err}>{photoErr}</span>}
            </div>
            {showInvite && (
              <div className={s.inviteBox}>
                <input className={s.input} placeholder="Chamar um amigo pelo nome ou e-mail" value={q} onChange={e => setQ(e.target.value)} />
                {found.map(u => (
                  <div key={u.id} className={s.userRow}>
                    <div><b>{u.name}</b><small>{u.hint}</small></div>
                    <button disabled={sent[u.id]} onClick={() => invite(u)} className={s.ghost}>{sent[u.id] ? '✓ Convidado' : 'Convidar'}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className={s.chat}>
          <span className={s.label}>CONVERSA</span>
          <div className={s.msgs}>
            {tg.messages.length === 0 && <p className={s.muted} style={{ textAlign: 'center', marginTop: 24 }}>Diga oi pra galera 👋</p>}
            {tg.messages.map(m => {
              const mine = m.userId === tg.you?.userId;
              return (
                <div key={m.id} className={`${s.msg} ${mine ? s.mine : ''}`}>
                  {!mine && <b style={{ color: colorOf(m.userId) }}>{m.name.split(' ')[0]}</b>}
                  <span>{m.text}</span>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          <form className={s.sendRow} onSubmit={send}>
            <input className={s.input} value={text} onChange={e => setText(e.target.value)} placeholder="Mensagem…" maxLength={500} />
            <button className={s.send} type="submit" disabled={!text.trim()}>Enviar</button>
          </form>
          {host
            ? <button className={s.start} onClick={() => tg.startRoom()}>▶ Iniciar para todos</button>
            : <div className={s.waiting}><i />Aguardando o anfitrião iniciar…</div>}
        </aside>
      </div>
    </main>
  );
}
