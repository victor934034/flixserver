'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/api';
import s from '../ui.module.css';

const LANG = { por: 'Português', eng: 'Inglês', spa: 'Espanhol', jpn: 'Japonês' };
const STATUS = {
  broken: ['Com defeito', 'b_over'], queued: ['Na fila', 'b_pend'], converting: ['Convertendo', 'b_pend'],
  fixed: ['Consertado', 'b_paid'], ok: ['Já estava bom', 'b_ref'], error: ['Falhou', 'b_over'],
};
const channels = n => (n === 6 ? '5.1' : n === 8 ? '7.1' : n === 2 ? 'estéreo' : n === 1 ? 'mono' : `${n} canais`);
const BASE = '/admin/audio-51';

export default function Audio51Page() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api.get(`${BASE}/status`)
    .then(r => setData(r.data))
    .catch(e => setError(e.response?.data?.error || e.message)), []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function post(path, body) {
    setError('');
    try { await api.post(`${BASE}${path}`, body); } catch (e) { setError(e.response?.data?.error || e.message); }
    load();
  }

  if (!data) return <p className={s.hint}>{error || 'Carregando...'}</p>;

  const pending = data.found.filter(f => f.status === 'broken' || f.status === 'error');
  const fixed = data.found.filter(f => f.status === 'fixed').length;

  return (
    <div>
      <h1 className={s.h1}>Áudio com defeito</h1>

      <div className={s.panel}>
        <h2>1. Procurar</h2>
        <p className={s.hint}>
          Acha os arquivos .mp4 cujo áudio alguns celulares Android não conseguem tocar. Os arquivos bons não são alterados.
          A busca é lenta de propósito (um arquivo por vez), para a Backblaze não bloquear os pedidos: pode levar algumas horas.
          Ela começa pelos filmes e dá para parar e continuar depois.
        </p>
        <div className={s.row}>
          <button className={s.btn} disabled={!!data.activity} onClick={() => post('/scan', {})}>
            {data.cursor && !data.finished ? 'Continuar busca' : 'Procurar'}
          </button>
          {data.activity && <button className={s.btn2} onClick={() => post('/stop')}>Parar depois do arquivo atual</button>}
        </div>
        <p className={s.hint}>
          {data.total ? `${data.cursor} de ${data.total} arquivos vistos` : 'Nenhuma busca feita ainda'}
          {data.finished ? ' (busca completa)' : ''}
          {data.unreadable ? ` · ${data.unreadable} não puderam ser lidos` : ''}
          {data.activity ? ` · ${data.activity === 'scan' ? 'procurando' : 'convertendo'}: ${data.current}` : ''}
        </p>
        {data.message && <p className={s.err}>{data.message}</p>}
        {error && <p className={s.err}>{error}</p>}
      </div>

      <div className={s.panel}>
        <h2>2. Converter ({pending.length} com defeito, {fixed} consertados)</h2>
        <p className={s.hint}>
          Só a faixa com defeito é convertida, para o 5.1 padrão. A imagem e as outras faixas são copiadas sem alteração.
          O arquivo novo é conferido antes de entrar no catálogo, e o antigo continua guardado na Backblaze.
          Comece por um só e teste no celular.
        </p>
        {pending.length > 1 && (
          <div className={s.row}>
            <button className={s.btn2} disabled={data.activity === 'scan'}
              onClick={() => { if (window.confirm(`Converter ${pending.length} arquivos? Isso baixa e envia vários GB.`)) post('/fix', { urls: pending.map(f => f.url) }); }}>
              Converter todos os {pending.length}
            </button>
          </div>
        )}
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Título</th><th>Faixas de áudio</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {data.found.map(f => (
                <tr key={f.url}>
                  <td>{f.title}<div className={s.mono}>{decodeURIComponent(f.url.split('/').pop())}</div></td>
                  <td>
                    {f.tracks.map((t, i) => (
                      <div key={i} className={t.broken ? s.err : undefined}>
                        {LANG[t.language] || t.language || `Faixa ${i + 1}`} · {channels(t.channels)}{t.broken ? ' · com defeito' : ''}
                      </div>
                    ))}
                  </td>
                  <td>
                    <span className={`${s.badge} ${s[STATUS[f.status]?.[1] || 'b_ref']}`}>{STATUS[f.status]?.[0] || f.status}</span>
                    {f.step && <div className={s.hint}>{f.step}</div>}
                    {f.error && <div className={s.err}>{f.error}</div>}
                  </td>
                  <td>
                    {(f.status === 'broken' || f.status === 'error') && (
                      <button className={s.btn2} disabled={data.activity === 'scan'} onClick={() => post('/fix', { urls: [f.url] })}>Converter</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
