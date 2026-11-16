'use client';
import { useEffect, useRef, useState } from 'react';
import ChatThread from '../../../components/ChatThread';
import api from '../../../lib/api';
import styles from './page.module.css';

function fmtWhen(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function AdminChatPage() {
  const [convs, setConvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [filter, setFilter] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchTimer = useRef(null);

  // /admin/chat?user=ID abre direto a conversa (link da notificação)
  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get('user');
    if (u) setSelected(u);
  }, []);

  // Lista de conversas em tempo real (long polling)
  useEffect(() => {
    let alive = true;
    let ctrl = null;
    let since = null;
    (async () => {
      let failures = 0;
      while (alive) {
        ctrl = new AbortController();
        try {
          const { data } = await api.get('/chat/admin/conversations', {
            params: since ? { since, wait: 1 } : {},
            signal: ctrl.signal,
            timeout: 35000,
          });
          if (!alive) break;
          setConvs(data.conversations || []);
          since = data.now;
          setLoading(false);
          failures = 0;
        } catch {
          if (!alive) break;
          failures++;
          await new Promise(r => setTimeout(r, Math.min(10000, 1000 * failures)));
        }
      }
    })();
    return () => { alive = false; ctrl?.abort(); };
  }, []);

  // Busca de usuário pra começar conversa nova
  useEffect(() => {
    clearTimeout(searchTimer.current);
    const q = filter.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(() => {
      api.get('/chat/admin/users', { params: { q } }).then(r => setSearchResults(r.data || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [filter]);

  const q = filter.trim().toLowerCase();
  const shown = q
    ? convs.filter(c => (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))
    : convs;
  const newPeople = searchResults.filter(u => !convs.some(c => c.user_id === u.id));
  const current = convs.find(c => c.user_id === selected) || (selectedUser?.id === selected ? selectedUser : null);

  function open(id, user) {
    setSelected(id);
    if (user) setSelectedUser(user);
    setConvs(prev => prev.map(c => c.user_id === id ? { ...c, unread: 0 } : c));
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Chat ao vivo</h1>
      <div className={styles.layout}>
        <aside className={`${styles.sidebar} ${selected ? styles.hideOnMobile : ''}`}>
          <input
            className={styles.search}
            placeholder="Buscar ou iniciar conversa (nome/e-mail)"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <div className={styles.convList}>
            {loading && <p className={styles.muted}>Carregando...</p>}
            {!loading && shown.length === 0 && newPeople.length === 0 && (
              <p className={styles.muted}>{q ? 'Ninguém encontrado.' : 'Nenhuma conversa ainda.'}</p>
            )}
            {shown.map(c => (
              <button
                key={c.user_id}
                className={`${styles.conv} ${selected === c.user_id ? styles.convActive : ''}`}
                onClick={() => open(c.user_id)}
              >
                <div className={styles.avatar}>{(c.name || c.email || '?')[0].toUpperCase()}</div>
                <div className={styles.convBody}>
                  <div className={styles.convTop}>
                    <span className={styles.convName}>{c.name || c.email || 'Usuário'}</span>
                    <span className={styles.convTime}>{fmtWhen(c.last_at)}</span>
                  </div>
                  <div className={styles.convBottom}>
                    <span className={styles.convLast}>{c.last_sender === 'admin' ? 'Você: ' : ''}{c.last_message}</span>
                    {c.unread > 0 && <span className={styles.badge}>{c.unread}</span>}
                  </div>
                </div>
              </button>
            ))}
            {newPeople.length > 0 && <p className={styles.sectionLabel}>Iniciar conversa</p>}
            {newPeople.map(u => (
              <button key={u.id} className={styles.conv} onClick={() => open(u.id, u)}>
                <div className={styles.avatar}>{(u.name || u.email || '?')[0].toUpperCase()}</div>
                <div className={styles.convBody}>
                  <span className={styles.convName}>{u.name || 'Usuário'}</span>
                  <span className={styles.convLast}>{u.email}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className={`${styles.thread} ${!selected ? styles.hideOnMobile : ''}`}>
          {selected ? (
            <>
              <div className={styles.threadHead}>
                <button className={styles.back} onClick={() => setSelected(null)}>←</button>
                <div>
                  <div className={styles.threadName}>{current?.name || 'Usuário'}</div>
                  <div className={styles.threadEmail}>{current?.email || ''}</div>
                </div>
              </div>
              <div className={styles.threadBody}>
                <ChatThread
                  key={selected}
                  listUrl={`/chat/admin/conversations/${selected}/messages`}
                  sendUrl={`/chat/admin/conversations/${selected}/messages`}
                  me="admin"
                  emptyText="Envie a primeira mensagem para este usuário."
                />
              </div>
            </>
          ) : (
            <div className={styles.emptyThread}>Selecione uma conversa</div>
          )}
        </section>
      </div>
    </div>
  );
}
