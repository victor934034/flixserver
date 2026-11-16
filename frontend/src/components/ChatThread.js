'use client';
// Conversa do chat de suporte (usada pelo usuário em /suporte e pelo admin em
// /admin/chat). Tempo real por long polling: pergunta "tem mensagem nova depois
// da última?" e o servidor só responde quando chega algo (ou após ~20s).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import api from '../lib/api';
import styles from './ChatThread.module.css';

const ACCEPT = 'image/*,video/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.srt,.vtt,.csv';

function fmtTime(iso) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? hm : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hm}`;
}

function fmtSize(b) {
  if (!b) return '';
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function Attachment({ m }) {
  if (!m.attachment_url && !m.localPreview) return null;
  const url = m.attachment_url || m.localPreview;
  if (m.attachment_type === 'image') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={styles.media}>
        <img src={url} alt={m.attachment_name || 'foto'} loading="lazy" />
      </a>
    );
  }
  if (m.attachment_type === 'video') {
    return <video className={styles.media} src={url} controls preload="metadata" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className={styles.file} download={m.attachment_name}>
      <span className={styles.fileIcon}>📎</span>
      <span className={styles.fileInfo}>
        <span className={styles.fileName}>{m.attachment_name || 'arquivo'}</span>
        <span className={styles.fileSize}>{fmtSize(m.attachment_size)}</span>
      </span>
    </a>
  );
}

/**
 * props:
 *  - listUrl: GET que devolve mensagens (array, ou { messages })
 *  - sendUrl: POST multipart { body, file }
 *  - me: 'user' | 'admin' (lado "meu" das bolhas)
 *  - emptyText
 */
export default function ChatThread({ listUrl, sendUrl, me, emptyText }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const lastAtRef = useRef(null);
  const atBottomRef = useRef(true);

  const merge = useCallback((incoming) => {
    if (!incoming?.length) return;
    setMessages(prev => {
      const ids = new Set(prev.filter(m => m.id).map(m => m.id));
      const fresh = incoming.filter(m => !ids.has(m.id));
      if (!fresh.length) return prev;
      // Minha mensagem chegou pelo polling antes da resposta do envio: tira a
      // bolha "enviando" equivalente pra não aparecer duplicada
      const drop = new Set();
      for (const f of fresh) {
        const t = prev.find(m => m.tempId && !drop.has(m.tempId) && m.status !== 'error'
          && m.sender === f.sender && (m.body || '') === (f.body || '') && !!m.attachment_type === !!f.attachment_type);
        if (t) drop.add(t.tempId);
      }
      return [...prev.filter(m => !drop.has(m.tempId)), ...fresh];
    });
    const last = incoming[incoming.length - 1];
    if (!lastAtRef.current || last.created_at > lastAtRef.current) lastAtRef.current = last.created_at;
  }, []);

  // Carga inicial + loop de long polling
  useEffect(() => {
    let alive = true;
    let ctrl = null;
    setMessages([]);
    setLoading(true);
    lastAtRef.current = null;

    (async () => {
      try {
        const { data } = await api.get(listUrl);
        if (!alive) return;
        merge(Array.isArray(data) ? data : data.messages || []);
      } catch {}
      if (alive) setLoading(false);

      let failures = 0;
      while (alive) {
        ctrl = new AbortController();
        try {
          const { data } = await api.get(listUrl, {
            params: { after: lastAtRef.current || new Date(0).toISOString(), wait: 1 },
            signal: ctrl.signal,
            timeout: 35000,
          });
          if (!alive) break;
          merge(Array.isArray(data) ? data : data.messages || []);
          failures = 0;
        } catch (e) {
          if (!alive) break;
          failures++;
          await new Promise(r => setTimeout(r, Math.min(10000, 1000 * failures)));
        }
      }
    })();

    return () => { alive = false; ctrl?.abort(); };
  }, [listUrl, merge]);

  // Rola pro fim quando chega mensagem (se já estava no fim)
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function pickFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 100 * 1024 * 1024) { setError('Arquivo muito grande (máx. 100 MB)'); return; }
    setError('');
    setFile(f);
  }

  async function send(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body && !file) return;
    setError('');

    const tempId = `tmp_${Date.now()}`;
    const kind = file ? (file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file') : null;
    const optimistic = {
      tempId, sender: me, body, created_at: new Date().toISOString(), status: 'sending', progress: 0,
      attachment_type: kind, attachment_name: file?.name, attachment_size: file?.size,
      localPreview: file && kind !== 'file' ? URL.createObjectURL(file) : null,
    };
    atBottomRef.current = true;
    setMessages(prev => [...prev, optimistic]);
    setText('');
    const sending = file;
    setFile(null);

    const form = new FormData();
    form.append('body', body);
    if (sending) form.append('file', sending);

    try {
      const { data } = await api.post(sendUrl, form, {
        timeout: 0,
        onUploadProgress: (p) => {
          if (!p.total) return;
          const pct = Math.round((p.loaded / p.total) * 100);
          setMessages(prev => prev.map(m => m.tempId === tempId ? { ...m, progress: pct, status: pct >= 100 && sending ? 'scanning' : 'sending' } : m));
        },
      });
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev.filter(m => m.tempId !== tempId);
        return prev.map(m => m.tempId === tempId ? data : m);
      });
      if (!lastAtRef.current || data.created_at > lastAtRef.current) lastAtRef.current = data.created_at;
    } catch (err) {
      const msg = err.response?.data?.error || 'Não foi possível enviar';
      setMessages(prev => prev.map(m => m.tempId === tempId ? { ...m, status: 'error', errorMsg: msg } : m));
    }
  }

  function retry(m) {
    setMessages(prev => prev.filter(x => x.tempId !== m.tempId));
    setText(m.body || '');
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.list} ref={listRef} onScroll={onScroll}>
        {loading && <p className={styles.hint}>Carregando conversa...</p>}
        {!loading && messages.length === 0 && <p className={styles.hint}>{emptyText || 'Nenhuma mensagem ainda.'}</p>}
        {messages.map(m => {
          const mine = m.sender === me;
          return (
            <div key={m.id || m.tempId} className={`${styles.row} ${mine ? styles.mine : styles.theirs}`}>
              <div className={`${styles.bubble} ${mine ? styles.bubbleMine : styles.bubbleTheirs}`}>
                <Attachment m={m} />
                {m.body && <p className={styles.text}>{m.body}</p>}
                <span className={styles.meta}>
                  {m.status === 'sending' && (m.attachment_type ? `Enviando ${m.progress || 0}%` : 'Enviando...')}
                  {m.status === 'scanning' && 'Verificando vírus...'}
                  {m.status === 'error' && <button className={styles.retry} onClick={() => retry(m)}>⚠ {m.errorMsg} · tentar de novo</button>}
                  {!m.status && fmtTime(m.created_at)}
                  {!m.status && mine && <span className={styles.check}>{m.is_read ? ' ✓✓' : ' ✓'}</span>}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {file && (
        <div className={styles.pending}>
          <span>📎 {file.name} · {fmtSize(file.size)}</span>
          <button onClick={() => setFile(null)} aria-label="Remover anexo">✕</button>
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}

      <form className={styles.composer} onSubmit={send}>
        <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={pickFile} />
        <button type="button" className={styles.attachBtn} onClick={() => fileRef.current?.click()} title="Anexar foto, vídeo ou arquivo">📎</button>
        <textarea
          className={styles.input}
          value={text}
          rows={1}
          maxLength={4000}
          placeholder="Escreva uma mensagem..."
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button type="submit" className={styles.sendBtn} disabled={!text.trim() && !file}>Enviar</button>
      </form>
    </div>
  );
}
