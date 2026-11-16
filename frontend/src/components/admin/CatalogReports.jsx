'use client';
import { useRef, useState } from 'react';
import api from '../../lib/api';

// Relatórios de catálogo: versão Cinema, continuações/temporadas/episódios
// faltando (TMDB) e arquivos de vídeo que sumiram da B2 (404 real).

// Acompanha um job em background. Só desiste depois de várias falhas seguidas
// (antes uma única oscilação de rede encerrava com "Erro ao verificar progresso").
function pollJob(jobId, ref, { onProgress, onDone, onFail }) {
  let fails = 0;
  clearInterval(ref.current);
  ref.current = setInterval(async () => {
    try {
      const s = await api.get(`/admin/reports/job-status?jobId=${jobId}`);
      fails = 0;
      onProgress(s.data);
      if (!s.data.running) { clearInterval(ref.current); onDone(s.data); }
    } catch (e) {
      if (e.response?.status === 404 || ++fails >= 5) {
        clearInterval(ref.current);
        onFail(e.response?.data?.error || 'Erro ao verificar progresso.');
      }
    }
  }, 3000);
}

const SEQ_KIND = {
  continuacao: { label: 'Continuação', color: '#4caf50' },
  meio: { label: 'Filme do meio da franquia', color: '#ffa500' },
  anterior: { label: 'Filme anterior', color: '#888' },
};

const SEASON_KIND = {
  anterior: 'anterior', seguinte: 'seguinte', ambas: 'anterior e seguinte', meio: 'no meio', sem_nenhuma: 'nenhuma enviada ainda',
};

const box = { background: '#1a1a1a', borderRadius: 12, padding: 24, border: '1px solid #2a2a2a', marginBottom: 16 };
const listBox = { marginTop: 16, maxHeight: 320, overflowY: 'auto', borderTop: '1px solid #2a2a2a', paddingTop: 12, paddingRight: 8 };
const btn = (busy, color = '#1565c0') => ({
  padding: '10px 24px', borderRadius: 8, background: busy ? '#333' : color,
  color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer',
});
const msgColor = (m) => (m.startsWith('Erro') ? '#ff6b6b' : '#4caf50');
const fmtDate = (d) => (d ? d.split('-').reverse().join('/') : '');
const epList = (arr) => (arr.length > 12
  ? `${arr.slice(0, 12).map(n => `E${n}`).join(', ')} e mais ${arr.length - 12}`
  : arr.map(n => `E${n}`).join(', '));

export default function CatalogReports() {
  const [cinemaList, setCinemaList] = useState(null);
  const [cinemaLoading, setCinemaLoading] = useState(false);
  const [cinemaMsg, setCinemaMsg] = useState('');

  const [seqRunning, setSeqRunning] = useState(false);
  const [seqProgress, setSeqProgress] = useState(null);
  const [seqResult, setSeqResult] = useState(null);
  const [seqMsg, setSeqMsg] = useState('');
  const seqPollRef = useRef(null);

  const [seasRunning, setSeasRunning] = useState(false);
  const [seasProgress, setSeasProgress] = useState(null);
  const [seasResult, setSeasResult] = useState(null);
  const [seasMsg, setSeasMsg] = useState('');
  const seasPollRef = useRef(null);

  const [mfRunning, setMfRunning] = useState(false);
  const [mfProgress, setMfProgress] = useState(null);
  const [mfResult, setMfResult] = useState(null);
  const [mfMsg, setMfMsg] = useState('');
  const mfPollRef = useRef(null);

  async function loadCinema() {
    setCinemaLoading(true);
    setCinemaMsg('');
    setCinemaList(null);
    try {
      const r = await api.get('/admin/reports/cinema-versions');
      setCinemaList(r.data.items || []);
    } catch (e) {
      setCinemaMsg('Erro: ' + (e.response?.data?.error || e.message));
    }
    setCinemaLoading(false);
  }

  async function runSequels() {
    setSeqRunning(true);
    setSeqMsg('');
    setSeqResult(null);
    setSeqProgress(null);
    try {
      const r = await api.post('/admin/reports/missing-sequels', {}, { timeout: 60000 });
      setSeqProgress({ total: r.data.total, done: 0 });
      pollJob(r.data.jobId, seqPollRef, {
        onProgress: d => setSeqProgress({ total: d.total, done: d.done }),
        onDone: d => {
          setSeqRunning(false);
          setSeqResult(d.items);
          const cont = d.items.filter(i => i.kind === 'continuacao').length;
          setSeqMsg(d.items.length === 0
            ? '✓ Nenhum filme de franquia faltando.'
            : `${cont} continuação(ões) e ${d.items.length - cont} outro(s) filme(s) da franquia faltando${d.errors ? ` · ${d.errors} filme(s) não consultado(s) (erro no TMDB)` : ''}.`);
        },
        onFail: m => { setSeqRunning(false); setSeqMsg('Erro: ' + m); },
      });
    } catch (e) {
      setSeqRunning(false);
      setSeqMsg('Erro: ' + (e.response?.data?.error || e.message));
    }
  }

  async function runSeasons() {
    setSeasRunning(true);
    setSeasMsg('');
    setSeasResult(null);
    setSeasProgress(null);
    try {
      const r = await api.post('/admin/reports/missing-seasons', {}, { timeout: 60000 });
      setSeasProgress({ total: r.data.total, done: 0 });
      pollJob(r.data.jobId, seasPollRef, {
        onProgress: d => setSeasProgress({ total: d.total, done: d.done }),
        onDone: d => {
          setSeasRunning(false);
          setSeasResult(d.items);
          setSeasMsg(d.items.length === 0
            ? '✓ Nenhuma temporada ou episódio faltando.'
            : `${d.items.length} série(s) com temporada/episódio faltando${d.errors ? ` · ${d.errors} não consultada(s) (erro no TMDB)` : ''}.`);
        },
        onFail: m => { setSeasRunning(false); setSeasMsg('Erro: ' + m); },
      });
    } catch (e) {
      setSeasRunning(false);
      setSeasMsg('Erro: ' + (e.response?.data?.error || e.message));
    }
  }

  async function runMissingFiles() {
    setMfRunning(true);
    setMfMsg('');
    setMfResult(null);
    setMfProgress(null);
    try {
      const r = await api.post('/admin/reports/missing-files', {}, { timeout: 60000 });
      setMfProgress({ total: 0, done: 0 });
      pollJob(r.data.jobId, mfPollRef, {
        onProgress: d => setMfProgress({ total: d.total, done: d.done }),
        onDone: d => {
          setMfRunning(false);
          if (d.error) { setMfMsg('Erro: ' + d.error); return; }
          setMfResult(d.items);
          setMfMsg(d.items.length === 0 ? `✓ Nenhum arquivo ausente (${d.total} verificados).` : `${d.items.length} arquivo(s) ausente(s).`);
        },
        onFail: m => { setMfRunning(false); setMfMsg('Erro: ' + m); },
      });
    } catch (e) {
      setMfRunning(false);
      setMfMsg('Erro: ' + (e.response?.data?.error || e.message));
    }
  }

  return (
    <section style={{ marginBottom: 40 }}>
      <h3 style={{ color: '#fff', marginBottom: 16 }}>Relatórios de catálogo</h3>

      {/* Versão Cinema */}
      <div style={box}>
        <p style={{ color: '#fff', fontWeight: 600, margin: '0 0 4px' }}>Filmes com versão Cinema</p>
        <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>
          Lista os filmes que já têm o arquivo de versão "Cinema" enviado. Clique no filme para editar.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button disabled={cinemaLoading} onClick={loadCinema} style={btn(cinemaLoading)}>
            {cinemaLoading ? 'Buscando...' : 'Ver lista'}
          </button>
          {cinemaMsg && <span style={{ color: '#ff6b6b', fontSize: 13 }}>{cinemaMsg}</span>}
          {cinemaList && <span style={{ color: '#4caf50', fontSize: 13 }}>{cinemaList.length} filme(s) com versão Cinema.</span>}
        </div>
        {cinemaList && cinemaList.length > 0 && (
          <div style={listBox}>
            {cinemaList.map(m => (
              <a
                key={m.id}
                href={`/admin/filmes/${m.id}`}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid #222', textDecoration: 'none' }}
              >
                <span style={{ color: '#fff', fontSize: 13 }}>
                  {m.title}
                  {m.is_active === false && <span style={{ color: '#ff6b6b', fontSize: 11, marginLeft: 8 }}>inativo</span>}
                </span>
                <span style={{ color: '#888', fontSize: 12, flexShrink: 0 }}>{m.year || ''}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Continuações faltando */}
      <div style={box}>
        <p style={{ color: '#fff', fontWeight: 600, margin: '0 0 4px' }}>Continuações e filmes de franquia faltando</p>
        <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>
          Verifica no TMDB a franquia (coleção) de cada filme do catálogo e lista os filmes já lançados que ainda
          não estão aqui — separando continuações de filmes anteriores. Pode demorar alguns minutos.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button disabled={seqRunning} onClick={runSequels} style={btn(seqRunning)}>
            {seqRunning ? 'Verificando...' : 'Verificar continuações'}
          </button>
          {seqProgress && seqRunning && <span style={{ color: '#888', fontSize: 13 }}>{seqProgress.done}/{seqProgress.total}</span>}
          {seqMsg && <span style={{ color: msgColor(seqMsg), fontSize: 13 }}>{seqMsg}</span>}
        </div>
        {seqResult && seqResult.length > 0 && (
          <div style={listBox}>
            {seqResult.map(item => (
              <div key={item.tmdb_id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #222', alignItems: 'center' }}>
                {item.poster_path
                  ? <img src={item.poster_path} alt="" style={{ width: 36, height: 54, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 36, height: 54, borderRadius: 4, background: '#222', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                    {item.title}
                    {SEQ_KIND[item.kind] && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: SEQ_KIND[item.kind].color }}>
                        {SEQ_KIND[item.kind].label}
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#888', fontSize: 12 }}>
                    {item.collection} · lançado em {fmtDate(item.release_date)} · você tem "{item.foundVia}"
                  </div>
                </div>
                <a href={`https://www.themoviedb.org/movie/${item.tmdb_id}`} target="_blank" rel="noreferrer" style={{ color: '#1e88e5', fontSize: 12, flexShrink: 0 }}>
                  TMDB
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Temporadas / episódios faltando */}
      <div style={box}>
        <p style={{ color: '#fff', fontWeight: 600, margin: '0 0 4px' }}>Séries com temporada ou episódio faltando</p>
        <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>
          Compara cada série com o TMDB: temporadas já lançadas sem nenhum episódio aqui e episódios que já
          foram ao ar mas estão faltando dentro de uma temporada. Clique na série para editar.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button disabled={seasRunning} onClick={runSeasons} style={btn(seasRunning)}>
            {seasRunning ? 'Verificando...' : 'Verificar temporadas e episódios'}
          </button>
          {seasProgress && seasRunning && <span style={{ color: '#888', fontSize: 13 }}>{seasProgress.done}/{seasProgress.total}</span>}
          {seasMsg && <span style={{ color: msgColor(seasMsg), fontSize: 13 }}>{seasMsg}</span>}
        </div>
        {seasResult && seasResult.length > 0 && (
          <div style={listBox}>
            {seasResult.map(item => (
              <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid #222' }}>
                <a href={`/admin/series/${item.id}`} style={{ color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  {item.title}
                </a>
                {item.missing.length > 0 && (
                  <div style={{ color: '#888', fontSize: 12 }}>
                    Tem temporada(s) {item.have.join(', ') || 'nenhuma'} ·{' '}
                    <span style={{ color: '#ff8a65' }}>falta temporada {item.missing.join(', ')}</span>
                    {SEASON_KIND[item.kind] ? ` (${SEASON_KIND[item.kind]})` : ''}
                  </div>
                )}
                {(item.partial || []).map(p => (
                  <div key={p.season} style={{ color: '#888', fontSize: 12 }}>
                    Temporada {p.season}: tem {p.have} de {p.aired} episódios ·{' '}
                    <span style={{ color: '#ffb74d' }}>falta {epList(p.missing)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Arquivos ausentes na B2 */}
      <div style={{ ...box, marginBottom: 0 }}>
        <p style={{ color: '#fff', fontWeight: 600, margin: '0 0 4px' }}>Vídeos apagados do armazenamento (404 real)</p>
        <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>
          Cruza toda URL de vídeo salva no banco com a listagem real de arquivos na B2. Encontra
          versões (dublado/legendado/cinema/4k) que sumiram do armazenamento — dá 404 pra{' '}
          <strong style={{ color: '#fff' }}>todo mundo</strong>, não é bug de aparelho/cache. Pode
          demorar um pouco pra catálogos grandes (lista todo o bucket).
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button disabled={mfRunning} onClick={runMissingFiles} style={btn(mfRunning, '#b71c1c')}>
            {mfRunning ? 'Verificando...' : 'Verificar arquivos ausentes'}
          </button>
          {mfProgress && mfRunning && <span style={{ color: '#888', fontSize: 13 }}>{mfProgress.done}/{mfProgress.total || '...'}</span>}
          {mfMsg && <span style={{ color: msgColor(mfMsg), fontSize: 13 }}>{mfMsg}</span>}
        </div>
        {mfResult && mfResult.length > 0 && (
          <div style={listBox}>
            {mfResult.map((item, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #222' }}>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                  {item.title} <span style={{ color: '#888', fontWeight: 400 }}>({item.table === 'movies' ? 'filme' : 'episódio'})</span>
                </div>
                <div style={{ color: '#ff6b6b', fontSize: 12, wordBreak: 'break-all' }}>
                  {item.field.replace('file_', '')}: {item.key}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
