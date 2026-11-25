'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import s from '../ui.module.css';

const PERIODS = [7, 30, 90, 365];
const typeLabel = t => (t === 'movie' ? 'Filme' : 'Série');

function Table({ rows, columns, empty }) {
  if (!rows.length) return <p className={s.hint}>{empty}</p>;
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead><tr><th>#</th>{columns.map(c => <th key={c.label}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || `${row.type}:${row.title}`}>
              <td>{i + 1}</td>
              {columns.map(c => <td key={c.label}>{c.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RelatoriosPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    api.get('/admin/insights', { params: { days } })
      .then(r => { if (alive) setData(r.data); })
      .catch(() => { if (alive) setError('Não foi possível carregar o relatório.'); });
    return () => { alive = false; };
  }, [days]);

  const title = { label: 'Título', render: r => r.title };
  const type = { label: 'Tipo', render: r => typeLabel(r.content_type || r.type) };

  return (
    <div>
      <h1 className={s.h1}>O que as pessoas assistem</h1>
      <div className={s.chips} style={{ marginBottom: 16 }}>
        {PERIODS.map(p => (
          <button key={p} type="button" className={`${s.chip} ${days === p ? s.chipOn : ''}`} onClick={() => setDays(p)}>
            {p === 365 ? '1 ano' : `${p} dias`}
          </button>
        ))}
      </div>
      {error && <p className={s.err}>{error}</p>}
      {!data && !error && <p className={s.hint}>Carregando...</p>}
      {data && (
        <>
          <div className={s.grid}>
            <div className={s.stat}><span>Contas que assistiram</span><b>{data.active_accounts}</b></div>
            <div className={s.stat}><span>Títulos assistidos</span><b>{data.titles_watched}</b></div>
          </div>

          <section className={s.panel}>
            <h2>Mais assistidos</h2>
            <p className={s.hint}>Contas diferentes que assistiram pelo menos 1 minuto no período.</p>
            <Table rows={data.most_watched} empty="Nada assistido no período." columns={[title, type, { label: 'Contas', render: r => r.accounts }]} />
          </section>

          <section className={s.panel}>
            <h2>Largados no começo</h2>
            <p className={s.hint}>Parou antes de 15% e não voltou em 2 dias. Vale conferir se o arquivo, o áudio ou a legenda têm problema. Quem tira o título do “Continuar assistindo” sai desta conta.</p>
            <Table rows={data.abandoned} empty="Ninguém largou nada no começo." columns={[title, type, { label: 'Largaram', render: r => `${r.accounts} de ${r.watched_by}` }]} />
          </section>

          <section className={s.panel}>
            <h2>Pedidos mais repetidos</h2>
            <p className={s.hint}>Sugestões ainda abertas, de todos os períodos.</p>
            <Table rows={data.requests} empty="Nenhum pedido em aberto." columns={[title, type, { label: 'Pessoas pedindo', render: r => r.accounts }]} />
          </section>
        </>
      )}
    </div>
  );
}
