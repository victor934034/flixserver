import api from './api';

const VERSION_ORDER = ['dubbing', 'subtitled', 'cinema', '4k', 'color', 'bw'];

// Monta os params do player pra um filme/episódio (mesmo formato das telas de detalhe)
export function buildPlayerParams(type, c, { title, seriesId, room } = {}) {
  const versions = type === 'movie'
    ? { dubbing: c.file_dubbing || null, subtitled: c.file_subtitled || null, cinema: c.file_cinema || null, '4k': c.file_4k || null }
    : { dubbing: c.file_dubbing || null, subtitled: c.file_subtitled || null, cinema: c.file_cinema || null, color: c.file_color || null, bw: c.file_bw || null };
  const first = VERSION_ORDER.find(k => versions[k]);
  if (!first) return null;
  const params = {
    url: versions[first],
    title: title || c.title,
    id: String(c.id),
    type,
    currentVersion: first,
    versions: JSON.stringify(versions),
    subtitles: JSON.stringify({ pt: c.subtitle_pt || null, en: c.subtitle_en || null, es: c.subtitle_es || null }),
    room,
  };
  if (type === 'episode' && seriesId) params.seriesId = String(seriesId);
  if (type === 'episode' && c.intro_end) params.introEnd = String(c.intro_end);
  return params;
}

// Anfitrião: cria a sala e abre a sala de espera (lobby)
export async function startTogether(router, { type, content, title, seriesId }) {
  const { data: room } = await api.post('/together/rooms', {
    content_type: type === 'movie' ? 'movie' : 'episode',
    content_id: String(content.id), title, poster_url: content.poster_url || null,
  });
  const params = buildPlayerParams(type, content, { title, seriesId, room: room.code });
  if (!params) throw new Error('Vídeo indisponível');
  router.push({ pathname: '/juntos-sala', params: { code: room.code, host: '1', player: JSON.stringify(params) } });
}

// Convidado: busca a sala; se já começou vai direto pro player, senão entra na sala de espera
export async function joinTogether(router, code) {
  const { data: info } = await api.get(`/together/rooms/${code}`);
  const isMovie = info.content_type === 'movie';
  const { data: c } = await api.get(isMovie ? `/movies/${info.content_id}` : `/episodes/${info.content_id}`);
  const params = buildPlayerParams(isMovie ? 'movie' : 'episode', c, { title: info.title, seriesId: c.series_id, room: info.code });
  if (!params) throw new Error('Vídeo indisponível');
  if (info.started) router.replace({ pathname: '/player', params });
  else router.replace({ pathname: '/juntos-sala', params: { code: info.code, host: '0', player: JSON.stringify(params) } });
}
