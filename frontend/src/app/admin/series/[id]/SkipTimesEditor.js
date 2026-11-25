'use client';
import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import ui from '../../ui.module.css';

const FIELDS = [
  ['intro_start', 'Abertura começa'],
  ['intro_end', 'Abertura termina'],
  ['credits_start', 'Créditos começam'],
];

const toText = sec => {
  if (sec === null || sec === undefined) return '';
  const whole = Math.floor(sec);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};
// aceita "5:15" ou só os segundos
const toSeconds = text => {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/^(?:(\d+):)?(\d+(?:[.,]\d+)?)$/);
  return m ? Number(m[1] || 0) * 60 + Number(m[2].replace(',', '.')) : NaN;
};

const SOURCE = { manual: 'Corrigido por você', introdb: 'Automático (IntroDB)' };

export default function SkipTimesEditor({ episodeId }) {
  const [values, setValues] = useState(null);
  const [source, setSource] = useState(null);
  const [msg, setMsg] = useState({ text: '', error: false });
  const [busy, setBusy] = useState(false);

  const show = data => {
    setValues(Object.fromEntries(FIELDS.map(([k]) => [k, toText(data[k])])));
    setSource(data.source);
  };
  const load = () => api.get(`/episodes/${episodeId}/skip-times`).then(r => show(r.data))
    .catch(() => { show({}); setMsg({ text: 'Não deu para carregar.', error: true }); });

  useEffect(() => { setValues(null); setMsg({ text: '', error: false }); load(); }, [episodeId]);

  async function run(action) {
    setBusy(true);
    setMsg({ text: '', error: false });
    try { await action(); } catch (e) { setMsg({ text: e.response?.data?.error || 'Não deu certo. Tente de novo.', error: true }); }
    setBusy(false);
  }

  const save = () => run(async () => {
    const body = Object.fromEntries(FIELDS.map(([k]) => [k, toSeconds(values[k])]));
    if (Object.values(body).some(Number.isNaN)) { setMsg({ text: 'Use minutos:segundos, como 5:15.', error: true }); return; }
    const { data } = await api.put(`/episodes/${episodeId}/skip-times`, body);
    show(data);
    setMsg({ text: 'Salvo.', error: false });
  });

  const reset = () => run(async () => {
    await api.delete(`/episodes/${episodeId}/skip-times`);
    await load();
    setMsg({ text: 'Voltou para o automático.', error: false });
  });

  return (
    <div className={ui.panel} style={{ marginTop: 16 }}>
      <h2>Abertura e créditos</h2>
      <p className={ui.hint}>
        {values ? (SOURCE[source] || 'Sem dados para este episódio.') : 'Buscando...'} Deixe em branco e salve para esconder o botão neste episódio.
      </p>
      {values && (
        <>
          <div className={ui.row}>
            {FIELDS.map(([key, label]) => (
              <label key={key} style={{ fontSize: 12, color: '#888' }}>
                {label}<br />
                <input className={ui.input} style={{ width: 130 }} placeholder="min:seg" value={values[key]}
                  onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} />
              </label>
            ))}
          </div>
          <div className={ui.row} style={{ marginBottom: 0 }}>
            <button type="button" className={ui.btn} onClick={save} disabled={busy}>Salvar tempos</button>
            <button type="button" className={ui.btn2} onClick={reset} disabled={busy}>Usar automático</button>
            {msg.text && <span className={msg.error ? ui.err : ui.msg}>{msg.text}</span>}
          </div>
        </>
      )}
    </div>
  );
}
