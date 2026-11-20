'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/api';

// Cria a sala de "Assistir juntos" e leva o anfitrião pra ela.
export default function TogetherButton({ contentType, contentId, title, poster, className, style, label = '👥 Assistir juntos' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post('/together/rooms', { content_type: contentType, content_id: contentId, title, poster_url: poster });
      router.push(`/juntos/${data.code}?host=1`);
    } catch (e) {
      alert(e.response?.data?.error || 'Não foi possível criar a sessão.');
      setBusy(false);
    }
  }

  return <button type="button" className={className} style={style} onClick={start} disabled={busy}>{busy ? 'Criando…' : label}</button>;
}
