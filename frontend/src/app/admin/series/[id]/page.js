'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '../../../../lib/api';
import f from '../../filmes/novo/page.module.css';
import s from './page.module.css';

// ---- Episode inline form ----
function EpForm({ ep, setEp, onFetchSubs }) {
  const [fetchingSubs, setFetchingSubs] = useState(false);
  const [subsMsg, setSubsMsg] = useState('');

  async function handleFetchSubs() {
    setFetchingSubs(true);
    setSubsMsg('');
    try {
      const { found, results } = await onFetchSubs();
      if (results?.pt) setEp('subtitle_pt', results.pt);
      if (results?.en) setEp('subtitle_en', results.en);
      if (results?.es) setEp('subtitle_es', results.es);
      setSubsMsg(found?.length ? `Importadas: ${found.map(l => l.toUpperCase()).join(', ')}` : 'Nenhuma encontrada');
    } catch (e) {
      setSubsMsg(`Erro: ${e.response?.data?.error || e.message}`);
    } finally {
      setFetchingSubs(false);
    }
  }

  return (
    <div className={s.formGap}>
      <div className={s.grid3}>
        <div>
          <label className={f.label}>Temporada</label>
          <input className={f.input} type="number" min="1" value={ep.season_number || ''} onChange={e => setEp('season_number', Number(e.target.value))} />
        </div>
        <div>
          <label className={f.label}>Episódio</label>
          <input className={f.input} type="number" min="1" value={ep.episode_number || ''} onChange={e => setEp('episode_number', Number(e.target.value))} />
        </div>
        <div>
          <label className={f.label}>Título</label>
          <input className={f.input} value={ep.title || ''} onChange={e => setEp('title', e.target.value)} />
        </div>
      </div>

      <div>
        <label className={f.label}>Sinopse</label>
        <textarea className={f.textarea} rows={2} value={ep.synopsis || ''} onChange={e => setEp('synopsis', e.target.value)} />
      </div>

      <div className={s.grid4}>
        <div>
          <label className={f.label}>Thumbnail URL</label>
          <input className={f.input} value={ep.thumbnail_url || ''} onChange={e => setEp('thumbnail_url', e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <label className={f.label}>Data de exibição</label>
          <input className={f.input} type="date" value={ep.air_date || ''} onChange={e => setEp('air_date', e.target.value)} />
        </div>
        <div>
          <label className={f.label}>Duração (min)</label>
          <input className={f.input} type="number" value={ep.duration || ''} onChange={e => setEp('duration', Number(e.target.value))} />
        </div>
        <div>
          <label className={f.label}>Ativo</label>
          <select className={f.input} value={ep.is_active ? '1' : '0'} onChange={e => setEp('is_active', e.target.value === '1')}>
            <option value="1">Sim</option>
            <option value="0">Não</option>
          </select>
        </div>
      </div>

      <div className={s.grid3eq}>
        <div>
          <label className={f.label}>Vídeo — Dublado</label>
          <input className={f.input} value={ep.file_dubbing || ''} onChange={e => setEp('file_dubbing', e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
            <label className={f.label} style={{ margin: 0 }}>Vídeo — Legendado</label>
            {ep.file_dubbing && (
              <button type="button" onClick={() => setEp('file_subtitled', ep.file_dubbing)}
                style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                = Dublado
              </button>
            )}
          </div>
          <input className={f.input} value={ep.file_subtitled || ''} onChange={e => setEp('file_subtitled', e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <label className={f.label}>Vídeo — Cinema/Original</label>
          <input className={f.input} value={ep.file_cinema || ''} onChange={e => setEp('file_cinema', e.target.value)} placeholder="https://..." />
        </div>
      </div>
      <div className={s.grid3eq}>
        <div>
          <label className={f.label}>Vídeo — Colorido</label>
          <input className={f.input} value={ep.file_color || ''} onChange={e => setEp('file_color', e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <label className={f.label}>Vídeo — Preto e Branco</label>
          <input className={f.input} value={ep.file_bw || ''} onChange={e => setEp('file_bw', e.target.value)} placeholder="https://..." />
        </div>
        <div />
      </div>

      {onFetchSubs && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleFetchSubs} disabled={fetchingSubs} className={f.btnSearch}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
            {fetchingSubs ? 'Buscando...' : 'Buscar legendas'}
          </button>
          {subsMsg && (
            <span style={{ fontSize: '0.75rem', color: subsMsg.startsWith('Erro') ? '#ff6b6b' : '#4caf50' }}>{subsMsg}</span>
          )}
        </div>
      )}
      <div className={s.grid3eq}>
        <div>
          <label className={f.label}>Legenda PT (.vtt)</label>
          <input className={f.input} value={ep.subtitle_pt || ''} onChange={e => setEp('subtitle_pt', e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <label className={f.label}>Legenda EN (.vtt)</label>
          <input className={f.input} value={ep.subtitle_en || ''} onChange={e => setEp('subtitle_en', e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <label className={f.label}>Legenda ES (.vtt)</label>
          <input className={f.input} value={ep.subtitle_es || ''} onChange={e => setEp('subtitle_es', e.target.value)} placeholder="https://..." />
        </div>
      </div>
    </div>
  );
}

// ---- Main page ----
export default function EditarSerie() {
  const { id } = useParams();
  const router = useRouter();

  const [form, setFormState] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [tmdbSearch, setTmdbSearch] = useState('');
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // episode editing state
  const [editingId, setEditingId] = useState(null);
  const [epForm, setEpFormState] = useState({});
  const [addingEp, setAddingEp] = useState(false);
  const [newEp, setNewEpState] = useState({});
  const [savingEp, setSavingEp] = useState(false);

  const loadEpisodes = useCallback(() => {
    api.get(`/admin/series/${id}/episodes`)
      .then(r => setEpisodes(r.data || []))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    api.get(`/admin/series/${id}`)
      .then(r => {
        const s = r.data;
        setFormState({ ...s, genres: Array.isArray(s.genres) ? s.genres.join(', ') : s.genres || '' });
      })
      .catch(() => setError('Série não encontrada'));
    loadEpisodes();
  }, [id, loadEpisodes]);

  function set(key, value) {
    setFormState(prev => ({ ...prev, [key]: value }));
  }

  async function searchTMDB() {
    if (!tmdbSearch.trim()) return;
    setTmdbLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/tmdb/search?q=${encodeURIComponent(tmdbSearch)}&type=tv`);
      if (!data) { setError('Não encontrado no TMDB'); return; }
      const trailer = data.videos?.results?.find(v => v.type === 'Trailer');
      setFormState(prev => ({
        ...prev,
        tmdb_id: data.id,
        title: data.name || prev.title,
        original_title: data.original_name || prev.original_title,
        synopsis: data.overview || prev.synopsis,
        year_start: data.first_air_date ? data.first_air_date.split('-')[0] : prev.year_start,
        year_end: data.last_air_date ? data.last_air_date.split('-')[0] : prev.year_end,
        rating: data.vote_average ? Number(data.vote_average).toFixed(1) : prev.rating,
        total_seasons: data.number_of_seasons || prev.total_seasons,
        genres: data.genres?.map(g => g.name).join(', ') || prev.genres,
        poster_url: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : prev.poster_url,
        backdrop_url: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : prev.backdrop_url,
        trailer_url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : prev.trailer_url,
      }));
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao buscar no TMDB');
    } finally {
      setTmdbLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    if (!form.title?.trim()) { setError('Título é obrigatório'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        year_start: form.year_start ? Number(form.year_start) : null,
        year_end: form.year_end ? Number(form.year_end) : null,
        total_seasons: form.total_seasons ? Number(form.total_seasons) : null,
        rating: form.rating ? Number(form.rating) : null,
        genres: form.genres ? form.genres.split(',').map(g => g.trim()).filter(Boolean) : [],
      };
      await api.put(`/admin/series/${id}`, payload);
      router.push('/admin/series');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  // ---- episode helpers ----
  function setEp(key, value) {
    setEpFormState(prev => ({ ...prev, [key]: value }));
  }

  function setNew(key, value) {
    setNewEpState(prev => ({ ...prev, [key]: value }));
  }

  function startEdit(ep) {
    setEditingId(ep.id);
    setEpFormState({ ...ep });
    setAddingEp(false);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function fetchSubsForEp() {
    if (!form?.tmdb_id) throw new Error('Série sem TMDB ID');
    const { data } = await api.post('/upload/fetch-subtitles', {
      tmdbId: form.tmdb_id,
      movieId: epForm.id,
      movieType: 'episode',
      seasonNumber: epForm.season_number,
      episodeNumber: epForm.episode_number,
    });
    const found = Object.keys(data.results || {});
    return { found, results: data.results };
  }

  async function saveEp() {
    setSavingEp(true);
    try {
      await api.put(`/admin/episodes/${editingId}`, epForm);
      setEditingId(null);
      loadEpisodes();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao salvar episódio');
    } finally {
      setSavingEp(false);
    }
  }

  async function deleteEp(ep) {
    const label = `T${ep.season_number}E${String(ep.episode_number).padStart(2, '0')}${ep.title ? ` "${ep.title}"` : ''}`;
    if (!confirm(`Excluir ${label}?`)) return;
    await api.delete(`/admin/episodes/${ep.id}`);
    loadEpisodes();
  }

  function startAdd() {
    setAddingEp(true);
    setEditingId(null);
    const maxEp = episodes.length > 0 ? Math.max(...episodes.map(e => e.episode_number || 0)) : 0;
    const season = episodes.length > 0 ? (episodes[episodes.length - 1].season_number || 1) : 1;
    setNewEpState({ series_id: id, season_number: season, episode_number: maxEp + 1, is_active: true });
  }

  async function saveNewEp() {
    setSavingEp(true);
    try {
      await api.post('/admin/episodes', newEp);
      setAddingEp(false);
      loadEpisodes();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao criar episódio');
    } finally {
      setSavingEp(false);
    }
  }

  // Group episodes by season
  const seasons = {};
  for (const ep of episodes) {
    const sn = ep.season_number ?? 0;
    if (!seasons[sn]) seasons[sn] = [];
    seasons[sn].push(ep);
  }

  if (!form && !error) return <p style={{ color: 'var(--text-muted)', padding: '2rem' }}>Carregando...</p>;
  if (error && !form) return <p style={{ color: '#ff6b6b', padding: '2rem' }}>{error}</p>;

  return (
    <div>
      <h1 className={f.heading}>Editar Série: {form.title}</h1>

      {/* TMDB refresh */}
      <div className={f.tmdbBox}>
        <label className={f.label}>Atualizar dados do TMDB</label>
        <div className={f.tmdbRow}>
          <input
            type="text"
            placeholder="Nome da série..."
            value={tmdbSearch}
            onChange={e => setTmdbSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchTMDB())}
            className={f.input}
          />
          <button onClick={searchTMDB} disabled={tmdbLoading} className={f.btnSearch}>
            {tmdbLoading ? 'Buscando...' : 'Buscar TMDB'}
          </button>
        </div>
      </div>

      {/* Series metadata form */}
      <form onSubmit={handleSave} className={f.form}>
        <div className={f.row}>
          <div className={f.col}>
            <label className={f.label}>Título *</label>
            <input className={f.input} value={form.title || ''} onChange={e => set('title', e.target.value)} required />
          </div>
          <div className={f.col}>
            <label className={f.label}>Título original</label>
            <input className={f.input} value={form.original_title || ''} onChange={e => set('original_title', e.target.value)} />
          </div>
        </div>

        <div>
          <label className={f.label}>Sinopse</label>
          <textarea className={f.textarea} value={form.synopsis || ''} onChange={e => set('synopsis', e.target.value)} rows={4} />
        </div>

        <div className={f.row4}>
          <div>
            <label className={f.label}>Ano início</label>
            <input className={f.input} type="number" value={form.year_start || ''} onChange={e => set('year_start', e.target.value)} />
          </div>
          <div>
            <label className={f.label}>Ano fim</label>
            <input className={f.input} type="number" value={form.year_end || ''} onChange={e => set('year_end', e.target.value)} />
          </div>
          <div>
            <label className={f.label}>Temporadas</label>
            <input className={f.input} type="number" value={form.total_seasons || ''} onChange={e => set('total_seasons', e.target.value)} />
          </div>
          <div>
            <label className={f.label}>Nota</label>
            <input className={f.input} type="number" step="0.1" min="0" max="10" value={form.rating || ''} onChange={e => set('rating', e.target.value)} />
          </div>
        </div>

        <div className={f.row}>
          <div>
            <label className={f.label}>Classificação etária</label>
            <select className={f.input} value={form.age_rating || ''} onChange={e => set('age_rating', e.target.value)}>
              <option value="">—</option>
              {['L', '10', '12', '14', '16', '18'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={f.label}>Status</label>
            <select className={f.input} value={form.status || 'ongoing'} onChange={e => set('status', e.target.value)}>
              <option value="ongoing">Em andamento</option>
              <option value="ended">Encerrada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>
        </div>

        <div>
          <label className={f.label}>Gêneros (separados por vírgula)</label>
          <input className={f.input} value={form.genres || ''} onChange={e => set('genres', e.target.value)} placeholder="Drama, Ação, Comédia" />
        </div>

        <div className={f.row}>
          <div className={f.col}>
            <label className={f.label}>URL do Poster</label>
            <input className={f.input} value={form.poster_url || ''} onChange={e => set('poster_url', e.target.value)} />
          </div>
          <div className={f.col}>
            <label className={f.label}>URL do Backdrop</label>
            <input className={f.input} value={form.backdrop_url || ''} onChange={e => set('backdrop_url', e.target.value)} />
          </div>
        </div>

        {form.poster_url && (
          <Image src={form.poster_url} alt="poster" width={100} height={150} style={{ borderRadius: 4 }} />
        )}

        <div>
          <label className={f.label}>URL do Trailer (YouTube)</label>
          <input className={f.input} value={form.trailer_url || ''} onChange={e => set('trailer_url', e.target.value)} />
        </div>

        <hr className={f.divider} />

        <div className={f.checkRow}>
          <label className={f.checkLabel}>
            <input type="checkbox" checked={!!form.is_active} onChange={e => set('is_active', e.target.checked)} />
            Ativo (visível no site)
          </label>
          <label className={f.checkLabel}>
            <input type="checkbox" checked={!!form.is_featured} onChange={e => set('is_featured', e.target.checked)} />
            Destaque (banner)
          </label>
        </div>

        {form.is_featured && (
          <div>
            <label className={f.label}>Ordem no banner</label>
            <input className={f.input} type="number" value={form.featured_order || ''} onChange={e => set('featured_order', e.target.value)} style={{ width: 100 }} />
          </div>
        )}

        {error && <p className={f.error}>{error}</p>}

        <div className={f.formActions}>
          <button type="submit" className={f.btnSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Série'}
          </button>
          <button type="button" className={f.btnCancel} onClick={() => router.push('/admin/series')}>Cancelar</button>
        </div>
      </form>

      {/* ---- EPISODES ---- */}
      <div className={s.epSection}>
        <div className={s.epHeader}>
          <h2 className={s.epTitle}>Episódios ({episodes.length})</h2>
          <button className={s.btnAddEp} onClick={startAdd}>+ Adicionar Episódio</button>
        </div>

        {/* New episode form */}
        {addingEp && (
          <div className={s.epFormBox}>
            <div className={s.epFormTitle}>Novo Episódio</div>
            <EpForm ep={newEp} setEp={setNew} />
            <div className={s.epFormActions}>
              <button className={s.btnSaveEp} onClick={saveNewEp} disabled={savingEp}>
                {savingEp ? 'Salvando...' : 'Criar Episódio'}
              </button>
              <button className={s.btnCancelEp} onClick={() => setAddingEp(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {episodes.length === 0 && !addingEp && (
          <p style={{ color: 'var(--text-muted)' }}>Nenhum episódio cadastrado.</p>
        )}

        {Object.keys(seasons).sort((a, b) => Number(a) - Number(b)).map(seasonNum => (
          <div key={seasonNum} className={s.seasonBlock}>
            <div className={s.seasonTitle}>Temporada {seasonNum}</div>
            <table className={s.epTable}>
              <thead>
                <tr>
                  <th>Ep</th>
                  <th>Thumb</th>
                  <th>Título</th>
                  <th>Dub</th>
                  <th>Leg</th>
                  <th>Sub PT</th>
                  <th>Ativo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {seasons[seasonNum].map(ep => (
                  <>
                    <tr key={ep.id} className={editingId === ep.id ? s.rowEditing : ''}>
                      <td className={s.epNum}>E{String(ep.episode_number).padStart(2, '0')}</td>
                      <td>
                        {ep.thumbnail_url
                          ? <img src={ep.thumbnail_url} alt="" width={64} height={36} style={{ borderRadius: 3, objectFit: 'cover', display: 'block' }} />
                          : <div className={s.noThumb}>?</div>}
                      </td>
                      <td>
                        <div className={s.epTitleText}>{ep.title || '—'}</div>
                        {ep.duration && <div className={s.epMeta}>{ep.duration} min</div>}
                      </td>
                      <td>{ep.file_dubbing ? <span className={s.yes}>✓</span> : <span className={s.no}>✗</span>}</td>
                      <td>{ep.file_subtitled ? <span className={s.yes}>✓</span> : <span className={s.no}>✗</span>}</td>
                      <td>{ep.subtitle_pt ? <span className={s.yes}>✓</span> : <span className={s.no}>✗</span>}</td>
                      <td>{ep.is_active ? <span className={s.yes}>✓</span> : <span className={s.no}>✗</span>}</td>
                      <td>
                        <div className={s.epActions}>
                          <button
                            className={s.btnEdit}
                            onClick={() => editingId === ep.id ? cancelEdit() : startEdit(ep)}
                          >
                            {editingId === ep.id ? 'Fechar' : 'Editar'}
                          </button>
                          <button className={s.btnDelete} onClick={() => deleteEp(ep)}>Excluir</button>
                        </div>
                      </td>
                    </tr>

                    {editingId === ep.id && (
                      <tr key={`${ep.id}-form`}>
                        <td colSpan={8} className={s.epFormCell}>
                          <EpForm ep={epForm} setEp={setEp} onFetchSubs={form?.tmdb_id ? fetchSubsForEp : undefined} />
                          <div className={s.epFormActions}>
                            <button className={s.btnSaveEp} onClick={saveEp} disabled={savingEp}>
                              {savingEp ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button className={s.btnCancelEp} onClick={cancelEdit}>Cancelar</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
