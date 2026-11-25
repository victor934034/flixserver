'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import api from '../lib/api';
import { getToken } from '../lib/auth';
import s from './Extras.module.css';

const SEEN_KEY = 'seenArrivedSuggestions';
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || []; } catch { return []; } };

// Aviso de pedido atendido: um cartão no canto, só na página inicial.
export default function ArrivedNotice() {
  const pathname = usePathname();
  const router = useRouter();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (pathname !== '/' || !getToken()) return;
    api.get('/suggestions/arrived')
      .then(r => {
        const seen = readSeen();
        setItems((r.data || []).filter(i => !seen.includes(i.id)));
      })
      .catch(() => {});
  }, [pathname]);

  const item = items[0];
  if (pathname !== '/' || !item) return null;

  function dismiss() {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...readSeen(), item.id].slice(-50))); } catch {}
    setItems(list => list.slice(1));
  }

  return (
    <div className={s.arrived} role="status">
      {item.poster_url && <img src={item.poster_url} alt="" />}
      <div>
        <b>🎉 Seu pedido chegou!</b>
        <span>{item.title}</span>
        <div>
          <button type="button" className={s.arrivedGo} onClick={() => { dismiss(); router.push(`/${item.content_type === 'movie' ? 'filme' : 'serie'}/${item.content_id}`); }}>Assistir</button>
          <button type="button" className={s.arrivedClose} onClick={dismiss}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
