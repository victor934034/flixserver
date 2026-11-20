'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import VideoPlayer from '../../../components/VideoPlayer';
import TogetherPanel from '../../../components/TogetherPanel';
import TogetherInvite from '../../../components/TogetherInvite';
import api from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { useTogether } from '../../../lib/together';
import styles from './page.module.css';

export default function JuntosPage() {
  const { code: rawCode } = useParams();
  const code = String(rawCode || '').toUpperCase();
  const router = useRouter();
  const [info, setInfo] = useState(null);
  const [infoErr, setInfoErr] = useState('');
  const [joined, setJoined] = useState(false);
  const [content, setContent] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [blocked, setBlocked] = useState('');

  useEffect(() => {
    if (!getToken()) { router.replace(`/login?next=${encodeURIComponent('/juntos/' + code)}`); return; }
    api.get(`/together/rooms/${code}`).then(r => setInfo(r.data)).catch(e => setInfoErr(e.response?.data?.error || 'Sala não encontrada ou encerrada.'));
  }, [code, router]);

  const tg = useTogether(joined ? code : null);

  // carrega o vídeo quando a sala conecta
  useEffect(() => {
    if (tg.status !== 'ready' || !tg.room || content) return;
    const path = tg.room.content_type === 'movie' ? `/movies/${tg.room.content_id}` : `/episodes/${tg.room.content_id}`;
    api.get(path).then(r => setContent(r.data)).catch(() => setBlocked('Não foi possível carregar o conteúdo.'));
    if (tg.you?.host) setShowInvite(true);
  }, [tg.status, tg.room, tg.you, content]);

  if (infoErr) return <><Navbar /><main className={styles.center}><div className={styles.card}><h1>Convite inválido</h1><p>{infoErr}</p><a className={styles.btn} href="/">Ir para o início</a></div></main></>;
  if (!info) return <><Navbar /><main className={styles.center}><p className={styles.muted}>Carregando…</p></main></>;

  if (!joined) {
    return (
      <>
        <Navbar />
        <main className={styles.center}>
          <div className={styles.card}>
            {info.poster_url && <img className={styles.poster} src={info.poster_url} alt="" />}
            <p className={styles.muted}>{info.host_name} chamou você pra assistir junto</p>
            <h1>{info.title}</h1>
            <p className={styles.muted}>{info.members} {info.members === 1 ? 'pessoa já está' : 'pessoas já estão'} na sala</p>
            <button className={styles.btn} onClick={() => setJoined(true)}>Entrar na sessão</button>
          </div>
        </main>
      </>
    );
  }

  if (tg.status === 'error') {
    return <><Navbar /><main className={styles.center}><div className={styles.card}><h1>Não foi possível entrar</h1><p>{tg.error === 'login' ? 'Faça login para entrar.' : tg.error}</p><a className={styles.btn} href="/">Ir para o início</a></div></main></>;
  }
  if (tg.status === 'ended') {
    return <><Navbar /><main className={styles.center}><div className={styles.card}><h1>Sessão encerrada</h1><p>O anfitrião encerrou a sessão.</p><a className={styles.btn} href="/">Ir para o início</a></div></main></>;
  }

  return (
    <>
      <Navbar />
      <main className={styles.room}>
        <div className={styles.player}>
          {blocked ? <p className={styles.muted}>{blocked}</p> : !content ? <p className={styles.muted}>Conectando à sala…</p> : (
            <VideoPlayer content={content} sync={tg.sync} overlayTitle={tg.room?.title} />
          )}
          {tg.status === 'reconnecting' && <div className={styles.reconnect}>Reconectando…</div>}
        </div>
        <TogetherPanel tg={tg} onInvite={() => setShowInvite(true)} />
      </main>
      {showInvite && tg.room && <TogetherInvite room={tg.room} onClose={() => setShowInvite(false)} />}
    </>
  );
}
