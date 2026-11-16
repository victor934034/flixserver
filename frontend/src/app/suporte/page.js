'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import ChatThread from '../../components/ChatThread';
import api from '../../lib/api';
import { getToken } from '../../lib/auth';
import styles from './page.module.css';

export default function SuportePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [telegram, setTelegram] = useState('');

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    setReady(true);
    api.get('/settings').then(r => setTelegram(r.data?.telegram_link || '')).catch(() => {});
  }, [router]);

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.head}>
          <div>
            <h1 className={styles.title}>Suporte</h1>
            <p className={styles.subtitle}>Fale direto com a equipe Flixhome. Você pode enviar fotos, vídeos e arquivos.</p>
          </div>
          {telegram && (
            <a href={telegram} target="_blank" rel="noreferrer" className={styles.telegram}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="currentColor" d="M9.78 15.27 9.6 19.3c.36 0 .52-.16.71-.35l1.7-1.63 3.53 2.58c.65.36 1.11.17 1.29-.6l2.33-10.94c.21-.97-.35-1.35-.98-1.12L4.5 12.5c-.94.37-.93.9-.16 1.14l3.5 1.09 8.12-5.12c.38-.25.73-.11.44.14z" />
              </svg>
              Grupo no Telegram
            </a>
          )}
        </div>
        <div className={styles.chatBox}>
          {ready && (
            <ChatThread
              listUrl="/chat/messages"
              sendUrl="/chat/messages"
              me="user"
              emptyText="Mande sua dúvida, problema ou sugestão. Respondemos por aqui."
            />
          )}
        </div>
      </main>
    </>
  );
}
