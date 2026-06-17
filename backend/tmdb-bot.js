require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/original';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function detectType(filename) {
  const seriePatterns = [
    /s\d{1,2}e\d{1,2}/i,
    /\d{1,2}x\d{2}/i,
    /t\d{1,2}e\d{1,2}/i,
    /temporada[\s._]\d/i,
    /season[\s._]\d/i,
    /episodio[\s._]\d/i,
    /episode[\s._]\d/i,
  ];
  const name = filename.toLowerCase();
  return seriePatterns.some(p => p.test(name)) ? 'series' : 'movie';
}

function extractInfo(filename) {
  const type = detectType(filename);
  let name = path.basename(filename, path.extname(filename));
  let season = null;
  let episode = null;
  let year = null;

  if (type === 'series') {
    const match =
      name.match(/[Ss](\d{1,2})[Ee](\d{1,2})/) ||
      name.match(/(\d{1,2})x(\d{2})/i) ||
      name.match(/[Tt](\d{1,2})[Ee](\d{1,2})/);

    if (match) {
      season = parseInt(match[1]);
      episode = parseInt(match[2]);
      // Cut everything from S01E02 marker — only series title remains
      const markerIdx = name.search(/[Ss]\d{1,2}[Ee]\d{1,2}|[Tt]\d{1,2}[Ee]\d{1,2}|\d{1,2}x\d{2}/i);
      name = name.substring(0, markerIdx);
    }
  }

  // Extract year from what remains of the name
  const yearMatch = name.match(/[\.\s\-_(](\d{4})[\.\s\-_)]/);
  if (yearMatch) {
    const y = parseInt(yearMatch[1]);
    if (y >= 1900 && y <= 2100) {
      year = y;
      if (type === 'movie') {
        // For movies everything after the year is quality tags — cut here
        name = name.substring(0, yearMatch.index);
      } else {
        // For series just remove the year token from the title
        name = name.substring(0, yearMatch.index) + name.substring(yearMatch.index + yearMatch[0].length);
      }
    }
  }

  // Clean up separators — no need for keyword removal since we cut at year/episode marker
  name = name
    .replace(/\./g, ' ')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { type, name, season, episode, year };
}

function detectVersion(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes('4k') || lower.includes('2160p')) return '4k';
  if (lower.includes('cinema') || lower.includes('original')) return 'cinema';
  if (lower.includes('legendado') || lower.includes('leg.') || lower.includes('.sub.')) return 'subtitled';
  return 'dubbing';
}

async function searchTMDB(name, type, year = null) {
  const endpoint = type === 'movie' ? 'search/movie' : 'search/tv';
  const params = { api_key: TMDB_API_KEY, query: name, language: 'pt-BR' };
  if (year) params.year = year;

  const { data } = await axios.get(`${TMDB_BASE}/${endpoint}`, { params });
  if (data.results?.length > 0) return data.results[0];

  params.language = 'en-US';
  const retry = await axios.get(`${TMDB_BASE}/${endpoint}`, { params });
  return retry.data.results?.[0] || null;
}

async function getDetails(tmdbId, type) {
  const endpoint = type === 'movie' ? `movie/${tmdbId}` : `tv/${tmdbId}`;
  const { data } = await axios.get(`${TMDB_BASE}/${endpoint}`, {
    params: { api_key: TMDB_API_KEY, language: 'pt-BR', append_to_response: 'videos' },
  });
  return data;
}

async function getEpisodeDetails(tmdbId, season, episode) {
  try {
    const { data } = await axios.get(
      `${TMDB_BASE}/tv/${tmdbId}/season/${season}/episode/${episode}`,
      { params: { api_key: TMDB_API_KEY, language: 'pt-BR' } }
    );
    return data;
  } catch {
    return null;
  }
}

async function saveMovie(details, fileUrl, version) {
  const trailer = details.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');

  const movieData = {
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
    category: 'movie',
  };

  if (fileUrl) movieData[`file_${version}`] = fileUrl;

  const { data, error } = await supabase
    .from('movies')
    .upsert(movieData, { onConflict: 'tmdb_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function saveSeries(details) {
  const trailer = details.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');

  const seriesData = {
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
      details.status === 'Ended' ? 'ended' : details.status === 'Canceled' ? 'cancelled' : 'ongoing',
  };

  const { data, error } = await supabase
    .from('series')
    .upsert(seriesData, { onConflict: 'tmdb_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function saveEpisode(seriesId, tmdbId, season, episode, fileUrl, version) {
  const epDetails = await getEpisodeDetails(tmdbId, season, episode);

  const epData = {
    series_id: seriesId,
    season_number: season,
    episode_number: episode,
    title: epDetails?.name || null,
    synopsis: epDetails?.overview || null,
    duration: epDetails?.runtime || null,
    thumbnail_url: epDetails?.still_path ? `${TMDB_IMG}${epDetails.still_path}` : null,
    air_date: epDetails?.air_date || null,
    tmdb_episode_id: epDetails?.id || null,
  };

  if (fileUrl) epData[`file_${version}`] = fileUrl;

  const { data, error } = await supabase
    .from('episodes')
    .upsert(epData, { onConflict: 'series_id,season_number,episode_number' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Aceita array de strings (URLs) ou de objetos { url, version }
async function processFiles(fileList) {
  const report = { success: [], notFound: [], errors: [] };

  for (const item of fileList) {
    const fileUrl = typeof item === 'string' ? item : item.url;
    const forcedVersion = typeof item === 'object' ? item.version : null;
    const filename = fileUrl.split('/').pop();

    console.log(`\nProcessando: ${filename}`);

    try {
      const { type, name, season, episode, year } = extractInfo(filename);
      const version = forcedVersion || detectVersion(filename);

      console.log(`  Tipo: ${type} | Nome: "${name}" | Ano: ${year} | Temp: ${season} | Ep: ${episode} | Versão: ${version}`);

      const tmdbResult = await searchTMDB(name, type, year);

      if (!tmdbResult) {
        console.log('  Não encontrado no TMDB');
        report.notFound.push({ filename, name });
        continue;
      }

      console.log(`  Encontrado: "${tmdbResult.title || tmdbResult.name}" (ID: ${tmdbResult.id})`);

      const details = await getDetails(tmdbResult.id, type);

      if (type === 'movie') {
        const saved = await saveMovie(details, fileUrl, version);
        report.success.push({ filename, type: 'movie', title: saved.title });
      } else {
        const seriesRecord = await saveSeries(details);
        if (season && episode) {
          await saveEpisode(seriesRecord.id, details.id, season, episode, fileUrl, version);
        }
        report.success.push({ filename, type: 'series', title: details.name, season, episode });
      }

      await new Promise(r => setTimeout(r, 260)); // respeita rate limit TMDB
    } catch (err) {
      console.error('  Erro:', err.message);
      report.errors.push({ filename, error: err.message });
    }
  }

  console.log('\n========== RELATÓRIO ==========');
  console.log(`Processados: ${report.success.length} | Não encontrados: ${report.notFound.length} | Erros: ${report.errors.length}`);

  return report;
}

module.exports = { processFiles, detectType, extractInfo };

// Uso via CLI: node tmdb-bot.js "URL1" "URL2"
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Uso: node tmdb-bot.js "URL1" "URL2" ...');
    process.exit(1);
  }
  processFiles(args).then(() => process.exit(0));
}
