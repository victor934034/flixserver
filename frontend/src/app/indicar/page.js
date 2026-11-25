'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import { getToken } from '../../lib/auth';
import d from '../../components/Dialog.module.css';
import s from '../../components/Extras.module.css';

const CODE_KEY = 'referralCode'; // guarda o código do link enquanto a pessoa cria a conta

export default function IndicarPage() {
  const router = useRouter();
  const [info, setInfo] = useState(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fromLink = (new URLSearchParams(window.location.search).get('codigo') || '').toUpperCase().slice(0, 7);
    try { if (fromLink) localStorage.setItem(CODE_KEY, fromLink); } catch {}
    if (!getToken()) {
      router.replace(`/login?modo=cadastro&next=${encodeURIComponent('/indicar')}`);
      return;
    }
    try { setCode(fromLink || localStorage.getItem(CODE_KEY) || ''); } catch { setCode(fromLink); }
    api.get('/referrals/me').then(r => setInfo(r.data)).catch(() => setInfo({ enabled: false }));
  }, [router]);

  async function apply(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/referrals/apply', { code });
      try { localStorage.removeItem(CODE_KEY); } catch {}
      setInfo(i => ({ ...i, can_apply: false }));
      setMsg({ ok: true, text: 'Código aplicado! Quando você assinar, quem te indicou ganha os dias grátis.' });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'Não foi possível usar o código.' });
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const url = info.link || '';
    const text = `Vem pro FlixHome! Use meu código ${info.code} ao entrar.`;
    try {
      if (navigator.share) { await navigator.share({ title: 'FlixHome', text, url }); return; }
      await navigator.clipboard.writeText(`${text} ${url}`.trim());
      setCopied(true);
    } catch {}
  }

  return (
    <>
      <Navbar />
      <main className={s.page}>
        <div className={s.panel}>
          <h1>🎁 Indique um amigo</h1>
          {!info && <p>Carregando...</p>}
          {info && !info.enabled && <p>As indicações ainda não estão disponíveis.</p>}
          {info?.enabled && (
            <>
              <p>Quando um amigo que usou seu código fizer a primeira assinatura, você ganha <b>{info.days} dias grátis</b>.</p>
              <div className={s.code}>{info.code}</div>
              <button type="button" className={d.primary} onClick={share}>{copied ? 'Convite copiado!' : 'Compartilhar convite'}</button>
              <div className={s.counters}>
                <div><b>{info.invited}</b><span>usaram o código</span></div>
                <div><b>{info.rewarded}</b><span>assinaram</span></div>
                <div><b>{info.days_earned}</b><span>dias ganhos</span></div>
              </div>
              {info.can_apply && (
                <form onSubmit={apply} className={d.form}>
                  <p>Recebeu um código de um amigo? Digite antes da sua primeira assinatura.</p>
                  <input className={d.input} value={code} maxLength={7} placeholder="CÓDIGO" aria-label="Código de indicação" onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
                  <button type="submit" className={d.secondary} disabled={busy || code.length !== 7}>Usar código</button>
                </form>
              )}
              {msg && <span className={msg.ok ? s.ok : d.error}>{msg.text}</span>}
            </>
          )}
        </div>
      </main>
    </>
  );
}
