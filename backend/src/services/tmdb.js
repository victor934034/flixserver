const axios = require('axios');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/original';

// Converte classificação MPAA (EUA) para padrão brasileiro
function convertMPAA(cert) {
  return { G: 'L', PG: '10', 'PG-13': '12', R: '16', 'NC-17': '18' }[cert] || null;
}

// Converte TV Parental Guidelines (EUA) para padrão brasileiro
function convertUSTV(cert) {
  return { 'TV-Y': 'L', 'TV-Y7': 'L', 'TV-G': 'L', 'TV-PG': '10', 'TV-14': '14', 'TV-MA': '18' }[cert] || null;
}

// Extrai classificação de idade brasileira (ANCINE/CSC) do retorno do TMDB
function extractAgeRating(details, type) {
  if (type === 'movie') {
    const list = details.release_dates?.results || [];
    const br = list.find(r => r.iso_3166_1 === 'BR');
    const brCert = br?.release_dates?.find(d => d.certification)?.certification;
    if (brCert) return brCert;
    // Fallback para classificação dos EUA com conversão
    const us = list.find(r => r.iso_3166_1 === 'US');
    const usCert = us?.release_dates?.find(d => d.certification)?.certification;
    return convertMPAA(usCert);
  }
  // Série
  const list = details.content_ratings?.results || [];
  const br = list.find(r => r.iso_3166_1 === 'BR');
  if (br?.rating) return br.rating;
  const us = list.find(r => r.iso_3166_1 === 'US');
  return convertUSTV(us?.rating);
}

async function searchTMDB(query, type, year = null) {
  const endpoint = type === 'movie' ? 'search/movie' : 'search/tv';
  const params = { api_key: TMDB_API_KEY, query, language: 'pt-BR' };
  if (year) params.year = year;

  const { data } = await axios.get(`${TMDB_BASE}/${endpoint}`, { params });
  if (data.results && data.results.length > 0) return data.results[0];

  params.language = 'en-US';
  const retry = await axios.get(`${TMDB_BASE}/${endpoint}`, { params });
  return retry.data.results[0] || null;
}

async function getDetails(tmdbId, type) {
  const endpoint = type === 'movie' ? `movie/${tmdbId}` : `tv/${tmdbId}`;
  // release_dates traz classificações de filmes; content_ratings traz as de séries
  const extra = type === 'movie' ? 'release_dates' : 'content_ratings';
  const { data } = await axios.get(`${TMDB_BASE}/${endpoint}`, {
    params: {
      api_key: TMDB_API_KEY,
      language: 'pt-BR',
      append_to_response: `videos,credits,${extra}`,
    },
  });
  return data;
}

async function getEpisodeDetails(tmdbId, season, episode) {
  const { data } = await axios.get(
    `${TMDB_BASE}/tv/${tmdbId}/season/${season}/episode/${episode}`,
    { params: { api_key: TMDB_API_KEY, language: 'pt-BR' } }
  );
  return data;
}

function buildMovieData(details) {
  const trailer = details.videos?.results?.find(
    v => v.type === 'Trailer' && v.site === 'YouTube'
  );
  return {
    tmdb_id: details.id,
    title: details.title,
    original_title: details.original_title,
    synopsis: details.overview,
    year: details.release_date ? parseInt(details.release_date.split('-')[0]) : null,
    duration: details.runtime,
    rating: details.vote_average,
    age_rating: extractAgeRating(details, 'movie'),
    genres: details.genres?.map(g => g.name) || [],
    poster_url: details.poster_path ? `${TMDB_IMG}${details.poster_path}` : null,
    backdrop_url: details.backdrop_path ? `${TMDB_BACKDROP}${details.backdrop_path}` : null,
    trailer_url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
  };
}

function buildSeriesData(details) {
  const trailer = details.videos?.results?.find(
    v => v.type === 'Trailer' && v.site === 'YouTube'
  );
  return {
    tmdb_id: details.id,
    title: details.name,
    original_title: details.original_name,
    synopsis: details.overview,
    year_start: details.first_air_date ? parseInt(details.first_air_date.split('-')[0]) : null,
    year_end: details.last_air_date ? parseInt(details.last_air_date.split('-')[0]) : null,
    total_seasons: details.number_of_seasons,
    rating: details.vote_average,
    age_rating: extractAgeRating(details, 'series'),
    genres: details.genres?.map(g => g.name) || [],
    poster_url: details.poster_path ? `${TMDB_IMG}${details.poster_path}` : null,
    backdrop_url: details.backdrop_path ? `${TMDB_BACKDROP}${details.backdrop_path}` : null,
    trailer_url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
    status:
      details.status === 'Ended'
        ? 'ended'
        : details.status === 'Canceled'
        ? 'cancelled'
        : 'ongoing',
  };
}

module.exports = { searchTMDB, getDetails, getEpisodeDetails, buildMovieData, buildSeriesData, extractAgeRating };
