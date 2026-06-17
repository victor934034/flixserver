'use client';
import { useState } from 'react';
import api from '../../../lib/api';
import styles from './page.module.css';

export default function ImportarPage() {
  const [input, setInput] = useState('');
  const [version, setVersion] = useState('dubbing');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  async function handleImport() {
    const urls = input
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('http'));

    if (!urls.length) return;

    setLoading(true);
    setReport(null);
    try {
      const files = urls.map(url => ({ url, version }));
      const { data } = await api.post('/tmdb/batch', { files });
      setReport(data);
    } catch (err) {
      setReport({ error: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className={styles.heading}>Importar via TMDB Bot</h1>
      <p className={styles.desc}>
        Cole as URLs dos arquivos no Backblaze CDN (uma por linha). O bot detecta automaticamente o nome,
        busca os metadados no TMDB e cadastra no banco de dados.
      </p>

      <div className={styles.form}>
        <label className={styles.label}>URLs dos arquivos (uma por linha)</label>
        <textarea
          className={styles.textarea}
          rows={10}
          placeholder={`https://cineflix.victorlima0978.workers.dev/Avengers.Endgame.2019.Dublado.1080p.mkv\nhttps://cineflix.victorlima0978.workers.dev/Breaking.Bad.S01E01.Dublado.mkv`}
          value={input}
          onChange={e => setInput(e.target.value)}
        />

        <div className={styles.row}>
          <div>
            <label className={styles.label}>Versão dos arquivos</label>
            <select className={styles.select} value={version} onChange={e => setVersion(e.target.value)}>
              <option value="dubbing">Dublado</option>
              <option value="subtitled">Legendado</option>
              <option value="cinema">Cinema/Original</option>
              <option value="4k">4K</option>
            </select>
          </div>

          <button className={styles.btnImport} onClick={handleImport} disabled={loading || !input.trim()}>
            {loading ? 'Importando...' : `Importar ${input.split('\n').filter(l => l.trim().startsWith('http')).length} arquivo(s)`}
          </button>
        </div>
      </div>

      {report && (
        <div className={styles.report}>
          <h3 className={styles.reportTitle}>Relatório</h3>

          {report.error && <p className={styles.reportError}>{report.error}</p>}

          {report.success?.length > 0 && (
            <div className={styles.reportSection}>
              <h4 className={styles.reportOk}>✓ Importados com sucesso ({report.success.length})</h4>
              <ul className={styles.list}>
                {report.success.map((item, i) => (
                  <li key={i}>
                    <span className={styles.itemType}>{item.type}</span>
                    {item.title}
                    {item.season && ` — T${item.season}E${String(item.episode).padStart(2,'0')}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.notFound?.length > 0 && (
            <div className={styles.reportSection}>
              <h4 className={styles.reportWarn}>Não encontrados no TMDB ({report.notFound.length})</h4>
              <ul className={styles.list}>
                {report.notFound.map((item, i) => (
                  <li key={i}>{item.name} <span className={styles.faded}>({item.filename})</span></li>
                ))}
              </ul>
            </div>
          )}

          {report.errors?.length > 0 && (
            <div className={styles.reportSection}>
              <h4 className={styles.reportError}>Erros ({report.errors.length})</h4>
              <ul className={styles.list}>
                {report.errors.map((item, i) => (
                  <li key={i}>{item.filename}: <span className={styles.faded}>{item.error}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
