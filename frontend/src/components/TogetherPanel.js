'use client';
import { useEffect, useRef, useState } from 'react';
import s from './TogetherPanel.module.css';

const initials = (n) => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const COLORS = ['#7c3aed', '#0ea5e9', '#f97316', '#e11d48', '#14b8a6', '#eab308', '#6366f1', '#84cc16'];
const colorOf = (id) => COLORS[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

export default function TogetherPanel({ tg, onInvite }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [tg.messages.length]);

  const submit = (e) => { e.preventDefault(); if (!text.trim()) return; tg.sendChat(text); setText(''); };
  const host = tg.you?.host;

  return (
    <aside className={s.panel}>
      <div className={s.top}>
        <span className={`${s.chip} ${tg.status === 'ready' ? s.chipOk : s.chipWarn}`}>
          <i />{tg.status === 'ready' ? `Sincronizado · ${tg.members.length} assistindo` : 'Ressincronizando…'}
        </span>
      </div>

      <div className={s.avatars}>
        {tg.members.map(m => {
          const talking = tg.voice.speaking[m.id];
          return (
            <div key={m.id} className={s.av} title={m.name}>
              <div className={`${s.circle} ${talking ? s.talking : ''}`} style={{ background: colorOf(m.userId) }}>
                {m.avatar ? <img src={m.avatar} alt="" /> : initials(m.name)}
                {m.voice && !talking && <span className={s.mic}>🎙</span>}
              </div>
              <span>{m.id === tg.you?.id ? 'Você' : m.name.split(' ')[0]}{m.host ? ' ★' : ''}</span>
            </div>
          );
        })}
        <button className={s.add} onClick={onInvite} aria-label="Convidar">+<span>Convidar</span></button>
      </div>

      <div className={s.voice}>
        {!tg.voice.on ? (
          <button className={s.btn} onClick={tg.voice.join}>🎙 Entrar na conversa de voz</button>
        ) : (
          <>
            <button className={`${s.btn} ${tg.voice.muted ? s.btnMuted : s.btnOk}`} onClick={tg.voice.toggleMute}>
              {tg.voice.muted ? '🔇 Microfone mudo' : '🎙 Microfone ligado'}
            </button>
            <button className={s.ghost} onClick={tg.voice.leave}>Sair da voz</button>
          </>
        )}
        {tg.voice.micError && <p className={s.err}>{tg.voice.micError}</p>}
      </div>

      <div className={s.chat}>
        {tg.messages.length === 0 && <p className={s.empty}>Diga oi pra galera 👋</p>}
        {tg.messages.map(m => {
          const mine = m.from === tg.you?.id;
          return (
            <div key={m.id} className={`${s.msg} ${mine ? s.mine : ''}`}>
              {!mine && <b>{m.name.split(' ')[0]}</b>} {m.text}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form className={s.form} onSubmit={submit}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Mensagem…" maxLength={500} />
        <button type="submit" disabled={!text.trim()}>Enviar</button>
      </form>

      <button className={s.leave} onClick={() => (host ? (confirm('Encerrar a sessão para todos?') && tg.endRoom()) : (window.location.href = '/'))}>
        {host ? 'Encerrar para todos' : 'Sair da sessão'}
      </button>

      <div className={s.toasts}>
        {tg.toasts.map(t => <div key={t.id} className={s.toast}>{t.text}</div>)}
      </div>
    </aside>
  );
}
