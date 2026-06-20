const axios = require('axios');

const BASE = 'https://api.opensubtitles.com/api/v1';

function getHeaders() {
  const key = process.env.OPENSUBTITLES_API_KEY;
  if (!key) throw new Error('OPENSUBTITLES_API_KEY não configurado no servidor');
  return {
    'Api-Key': key,
    'User-Agent': 'FlixHome v1.0',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function searchSubtitles({ tmdbId, type, lang, seasonNumber, episodeNumber }) {
  const params = { languages: lang };
  if (type === 'episode') {
    params.parent_tmdb_id = String(tmdbId);
    params.season_number = String(seasonNumber);
    params.episode_number = String(episodeNumber);
    params.type = 'episode';
  } else {
    params.tmdb_id = String(tmdbId);
    params.type = 'movie';
  }
  const qs = new URLSearchParams(params).toString();
  const { data } = await axios.get(`${BASE}/subtitles?${qs}`, { headers: getHeaders() });
  return data.data || [];
}

async function getDownloadLink(fileId) {
  const { data } = await axios.post(`${BASE}/download`, { file_id: fileId }, { headers: getHeaders() });
  return data.link;
}

async function downloadContent(url) {
  const { data } = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(data);
}

module.exports = { searchSubtitles, getDownloadLink, downloadContent };
