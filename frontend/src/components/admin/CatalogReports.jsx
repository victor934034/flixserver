'use client';
import { useRef, useState } from 'react';
import api from '../../lib/api';

// Relatórios de catálogo: versão Cinema, sequências/temporadas faltando (TMDB)
// e arquivos de vídeo que sumiram da B2 (404 real, não é bug de dispositivo).
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

  return (
    <section style={{ marginBottom: 40 }}>
      <h3 style={{ color: '#fff', marginBottom: 16 }}>Relatórios de catálogo</h3>

      {/* Versão Cinema */}
      <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 24, border: '1px solid #2a2a2a', marginBottom: 16 }}>
        <p style={{ color: '#fff', fontWeight: 600, margin: '0 0 4px' }}>Filmes com versão Cinema</p>
        <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>
          Lista os filmes que já têm o arquivo de versão "Cinema" (sem CGI pós-produção) enviado.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button
            disabled={cinemaLoading}
            onClick={async () => {
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
            }}
            style={{
              padding: '10px 24px', borderRadius: 8,
              background: cinemaLoading ? '#333' : '#1565c0',
              color: '#fff', border: 'none', fontWeight: 700, fontSize: 14,
              cursor: cinemaLoading ? 'not-allowed' : 'pointer',
            }}>
            {cinemaLoading ? 'Buscando...' : 'Ver lista'}
          </button>
          {cinemaMsg && <span style={{ color: '#ff6b6b', fontSize: 13 }}>{cinemaMsg}</span>}
          {cinemaList && (
            <span style={{ color: '#4caf50', fontSize: 13 }}>
              {cinemaList.length} filme(s) com versão Cinema.
            </span>
          )}
        </div>
        {cinemaList && cinemaList.length > 0 && (
          <div style={{ marginTop: 16, maxHeight: 300, overflowY: 'auto', borderTop: '1px solid #2a2a2a', paddingTop: 12 }}>
            {cinemaList.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #222' }}>
                <span style={{ color: '#fff', fontSize: 13 }}>{m.title}</span>
                <span style={{ color: '#888', fontSize: 12 }}>{m.year || ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sequências faltando */}
      <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 24, border: '1px solid #2a2a2a', marginBottom: 16 }}>
        <p style={{ color: '#fff', fontWeight: 600, margin: '0 0 4px' }}>Filmes sem continuação já lançada</p>
        <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>
          Verifica no TMDB a franquia/coleção de cada filme do catálogo e lista continuações que já
          foram lançadas nos cinemas/streaming mas ainda não estão aqui. Consulta o TMDB filme a filme,
          pode demorar alguns minutos para catálogos grandes.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button
            disabled={seqRunning}
            onClick={async () => {
              setSeqRunning(true);
              setSeqMsg('');
              setSeqResult(null);
              setSeqProgress(null);
              clearInterval(seqPollRef.current);
              try {
                const r = await api.post('/admin/reports/missing-sequels', {}, { timeout: 30000 });
                const { jobId, total } = r.data;
                setSeqProgress({ total, done: 0 });
                seqPollRef.current = setInterval(async () => {
                  try {
                    const s = await api.get(`/admin/reports/job-status?jobId=${jobId}`);
                    setSeqProgress({ total: s.data.total, done: s.data.done });
                    if (!s.data.running) {
                      clearInterval(seqPollRef.current);
                      setSeqRunning(false);
                      setSeqResult(s.data.items);
                      setSeqMsg(s.data.items.length === 0 ? '✓ Nenhuma continuação faltando encontrada.' : '');
                    }
                  } catch {
                    clearInterval(seqPollRef.current);
                    setSeqRunning(false);
                    setSeqMsg('Erro ao verificar progresso.');
                  }
                }, 3000);
              } catch (e) {
                setSeqRunning(false);
                setSeqMsg('Erro: ' + (e.response?.data?.error || e.message));
              }
            }}
            style={{
              padding: '10px 24px', borderRadius: 8,
              background: seqRunning ? '#333' : '#1565c0',
              color: '#fff', border: 'none', fontWeight: 700, fontSize: 14,
              cursor: seqRunning ? 'not-allowed' : 'pointer',
            }}>
            {seqRunning ? 'Verificando...' : 'Verificar continuações'}
          </button>
          {seqProgress && seqRunning && (
            <span style={{ color: '#888', fontSize: 13 }}>{seqProgress.done}/{seqProgress.total}</span>
          )}
          {seqMsg && <span style={{ color: seqMsg.startsWith('Erro') ? '#ff6b6b' : '#4caf50', fontSize: 13 }}>{seqMsg}</span>}
        </div>
        {seqResult && seqResult.length > 0 && (
          <div style={{ marginTop: 16, maxHeight: 320, overflowY: 'auto', borderTop: '1px solid #2a2a2a', paddingTop: 12 }}>
            {seqResult.map(item => (
              <div key={item.tmdb_id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #222', alignItems: 'center' }}>
                {item.poster_path && (
                  <img src={item.poster_path} alt="" style={{ width: 36, height: 54, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                  <div style={{ color: '#888', fontSize: 12 }}>
                    {item.collection} · lançado em {item.release_date} · encontrado via "{item.foundVia}"
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Temporadas faltando */}
      <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 24, border: '1px solid #2a2a2a', marginBottom: 16 }}>
        <p style={{ color: '#fff', fontWeight: 600, margin: '0 0 4px' }}>Séries sem temporada já lançada</p>
        <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>
          Verifica no TMDB as temporadas de cada série do catálogo (anteriores ou seguintes) que já
          têm data de estreia passada mas ainda não têm nenhum episódio enviado aqui.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button
            disabled={seasRunning}
            onClick={async () => {
              setSeasRunning(true);
              setSeasMsg('');
              setSeasResult(null);
              setSeasProgress(null);
              clearInterval(seasPollRef.current);
              try {
                const r = await api.post('/admin/reports/missing-seasons', {}, { timeout: 30000 });
                const { jobId, total } = r.data;
                setSeasProgress({ total, done: 0 });
                seasPollRef.current = setInterval(async () => {
                  try {
                    const s = await api.get(`/admin/reports/job-status?jobId=${jobId}`);
                    setSeasProgress({ total: s.data.total, done: s.data.done });
                    if (!s.data.running) {
                      clearInterval(seasPollRef.current);
                      setSeasRunning(false);
                      setSeasResult(s.data.items);
                      setSeasMsg(s.data.items.length === 0 ? '✓ Nenhuma temporada faltando encontrada.' : '');
                    }
                  } catch {
                    clearInterval(seasPollRef.current);
                    setSeasRunning(false);
                    setSeasMsg('Erro ao verificar progresso.');
                  }
                }, 3000);
              } catch (e) {
                setSeasRunning(false);
                setSeasMsg('Erro: ' + (e.response?.data?.error || e.message));
              }
            }}
            style={{
              padding: '10px 24px', borderRadius: 8,
              background: seasRunning ? '#333' : '#1565c0',
              color: '#fff', border: 'none', fontWeight: 700, fontSize: 14,
              cursor: seasRunning ? 'not-allowed' : 'pointer',
            }}>
            {seasRunning ? 'Verificando...' : 'Verificar temporadas'}
          </button>
          {seasProgress && seasRunning && (
            <span style={{ color: '#888', fontSize: 13 }}>{seasProgress.done}/{seasProgress.total}</span>
          )}
          {seasMsg && <span style={{ color: seasMsg.startsWith('Erro') ? '#ff6b6b' : '#4caf50', fontSize: 13 }}>{seasMsg}</span>}
        </div>
        {seasResult && seasResult.length > 0 && (
          <div style={{ marginTop: 16, maxHeight: 320, overflowY: 'auto', borderTop: '1px solid #2a2a2a', paddingTop: 12 }}>
            {seasResult.map(item => (
              <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid #222' }}>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                <div style={{ color: '#888', fontSize: 12 }}>
                  Tem temporada(s) {item.have.join(', ') || 'nenhuma'} · falta {item.missing.join(', ')}
                  {' '}({item.kind === 'anterior' ? 'temporada anterior' : item.kind === 'seguinte' ? 'temporada seguinte' : item.kind === 'ambas' ? 'anterior e seguinte' : 'nenhuma enviada ainda'})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Arquivos ausentes na B2 */}
      <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 24, border: '1px solid #2a2a2a' }}>
        <p style={{ color: '#fff', fontWeight: 600, margin: '0 0 4px' }}>Vídeos apagados do armazenamento (404 real)</p>
        <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>
          Cruza toda URL de vídeo salva no banco com a listagem real de arquivos na B2. Encontra
          versões (dublado/legendado/cinema/4k) que sumiram do armazenamento — dá 404 pra{' '}
          <strong style={{ color: '#fff' }}>todo mundo</strong>, não é bug de aparelho/cache. Pode
          demorar um pouco pra catálogos grandes (lista todo o bucket).
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button
            disabled={mfRunning}
            onClick={async () => {
              setMfRunning(true);
              setMfMsg('');
              setMfResult(null);
              setMfProgress(null);
              clearInterval(mfPollRef.current);
              try {
                const r = await api.post('/admin/reports/missing-files', {}, { timeout: 30000 });
                const { jobId } = r.data;
                setMfProgress({ total: 0, done: 0 });
                mfPollRef.current = setInterval(async () => {
                  try {
                    const s = await api.get(`/admin/reports/job-status?jobId=${jobId}`);
                    setMfProgress({ total: s.data.total, done: s.data.done });
                    if (!s.data.running) {
                      clearInterval(mfPollRef.current);
                      setMfRunning(false);
                      if (s.data.error) {
                        setMfMsg('Erro: ' + s.data.error);
                      } else {
                        setMfResult(s.data.items);
                        setMfMsg(s.data.items.length === 0 ? `✓ Nenhum arquivo ausente (${s.data.total} verificados).` : '');
                      }
                    }
                  } catch {
                    clearInterval(mfPollRef.current);
                    setMfRunning(false);
                    setMfMsg('Erro ao verificar progresso.');
                  }
                }, 3000);
              } catch (e) {
                setMfRunning(false);
                setMfMsg('Erro: ' + (e.response?.data?.error || e.message));
              }
            }}
            style={{
              padding: '10px 24px', borderRadius: 8,
              background: mfRunning ? '#333' : '#b71c1c',
              color: '#fff', border: 'none', fontWeight: 700, fontSize: 14,
              cursor: mfRunning ? 'not-allowed' : 'pointer',
            }}>
            {mfRunning ? 'Verificando...' : 'Verificar arquivos ausentes'}
          </button>
          {mfProgress && mfRunning && (
            <span style={{ color: '#888', fontSize: 13 }}>{mfProgress.done}/{mfProgress.total || '...'}</span>
          )}
          {mfMsg && <span style={{ color: mfMsg.startsWith('Erro') ? '#ff6b6b' : '#4caf50', fontSize: 13 }}>{mfMsg}</span>}
        </div>
        {mfResult && mfResult.length > 0 && (
          <div style={{ marginTop: 16, maxHeight: 320, overflowY: 'auto', borderTop: '1px solid #2a2a2a', paddingTop: 12 }}>
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
