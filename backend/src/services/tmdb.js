const axios = require('axios');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/original';

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
  const { data } = await axios.get(`${TMDB_BASE}/${endpoint}`, {
    params: {
      api_key: TMDB_API_KEY,
      language: 'pt-BR',
      append_to_response: 'videos,credits',
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

module.exports = { searchTMDB, getDetails, getEpisodeDetails, buildMovieData, buildSeriesData };
