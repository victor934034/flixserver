require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/w1280';

const supabase = process.env.SUPABASE_URL
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

// Episódio sem temporada (numeração absoluta de anime, ex: One Piece):
// "One Piece EP 062", "One.Piece.Episodio.1071", "Naruto - Episode 12"
const ABSOLUTE_RE = /(?:^|[\s._\-\[(])(?:ep|eps|epis[oó]dio|episode)[\s._\-#]*(\d{1,4})(?![\dx])/i;

function detectType(filename) {
  const seriePatterns = [
    /s\d{1,2}[\s._-]?e\d{1,4}/i,
    /\d{1,2}x\d{1,4}/i,
    /t\d{1,2}[\s._-]?e\d{1,4}/i,
    /temporada[\s._]\d/i,
    /season[\s._]\d/i,
    ABSOLUTE_RE,
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
    // Episódio aceita até 4 dígitos (antes eram 2: "S01E062" virava E06 e
    // sobrescrevia o episódio 6 — quebrava animes longos como One Piece)
    const match =
      name.match(/[Ss](\d{1,2})[\s._-]?[Ee](\d{1,4})/) ||
      name.match(/(\d{1,2})x(\d{1,4})/i) ||
      name.match(/[Tt](\d{1,2})[\s._-]?[Ee](\d{1,4})/);
    const abs = !match && name.match(ABSOLUTE_RE);

    if (match) {
      season = parseInt(match[1]);
      episode = parseInt(match[2]);
      // Cut everything from S01E02 marker — only series title remains
      const markerIdx = name.search(/[Ss]\d{1,2}[\s._-]?[Ee]\d{1,4}|[Tt]\d{1,2}[\s._-]?[Ee]\d{1,4}|\d{1,2}x\d{1,4}/i);
      name = name.substring(0, markerIdx);
      // Remove "EP" / "EP." / "Episodio" que fica logo antes do marcador
      // Ex: "Chicago.P.D.Distrito.21.EP." → "Chicago.P.D.Distrito.21."
      name = name.replace(/[\s._-]*\bep(?:is[oó]dio)?\b[\s._-]*$/i, '');
    } else if (abs) {
      season = null; // resolvido depois pela lista de temporadas do TMDB
      episode = parseInt(abs[1]);
      name = name.substring(0, abs.index);
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

function isDualAudio(filename) {
  const lower = filename.toLowerCase();
  return /dual[\s._\-]?(audio|áudio|udio)?/i.test(lower);
}

function srtToVtt(srt) {
  return 'WEBVTT\n\n' + srt
    .replace(/\r\n/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .trim();
}

async function autoFetchSubtitles({ movieId, tmdbId, movieType, seasonNumber, episodeNumber }) {
  if (!process.env.OPENSUBTITLES_API_KEY) return;
  const { searchSubtitles, getDownloadLink, downloadContent } = require('./src/services/opensubtitles');
  const { uploadFile } = require('./src/services/backblaze');
  const langMap = { pt: 'pt-BR', en: 'en', es: 'es' };
  for (const [dbLang, apiLang] of Object.entries(langMap)) {
    try {
      const hits = await searchSubtitles({ tmdbId, type: movieType, lang: apiLang, seasonNumber, episodeNumber });
      if (!hits.length) { console.log(`  [subtitles] ${dbLang}: não encontrado`); continue; }
      const sorted = hits.sort((a, b) => (b.attributes?.download_count || 0) - (a.attributes?.download_count || 0));
      const file = sorted[0]?.attributes?.files?.[0];
      if (!file?.file_id) continue;
      const link = await getDownloadLink(file.file_id);
      const srtBuffer = await downloadContent(link);
      const vttBuffer = Buffer.from(srtToVtt(srtBuffer.toString('utf-8')), 'utf-8');
      const uploaded = await uploadFile(vttBuffer, `subtitles/${movieId}_${dbLang}.vtt`, 'text/vtt');
      const table = movieType === 'episode' ? 'episodes' : 'movies';
      await supabase.from(table).update({ [`subtitle_${dbLang}`]: uploaded.cdnUrl }).eq('id', movieId);
      console.log(`  [subtitles] ${dbLang}: ok`);
    } catch (e) {
      console.warn(`  [subtitles] ${dbLang}:`, e.message);
    }
  }
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

function convertMPAA(cert) {
  return { G: 'L', PG: '10', 'PG-13': '12', R: '16', 'NC-17': '18' }[cert] || null;
}
function convertUSTV(cert) {
  return { 'TV-Y': 'L', 'TV-Y7': 'L', 'TV-G': 'L', 'TV-PG': '10', 'TV-14': '14', 'TV-MA': '18' }[cert] || null;
}
function extractAgeRating(details, type) {
  if (type === 'movie') {
    const list = details.release_dates?.results || [];
    const br = list.find(r => r.iso_3166_1 === 'BR');
    const brCert = br?.release_dates?.find(d => d.certification)?.certification;
    if (brCert) return brCert;
    const us = list.find(r => r.iso_3166_1 === 'US');
    return convertMPAA(us?.release_dates?.find(d => d.certification)?.certification);
  }
  const list = details.content_ratings?.results || [];
  const br = list.find(r => r.iso_3166_1 === 'BR');
  if (br?.rating) return br.rating;
  return convertUSTV(list.find(r => r.iso_3166_1 === 'US')?.rating);
}

async function getDetails(tmdbId, type) {
  const endpoint = type === 'movie' ? `movie/${tmdbId}` : `tv/${tmdbId}`;
  const extra = type === 'movie' ? 'release_dates' : 'content_ratings';
  const { data } = await axios.get(`${TMDB_BASE}/${endpoint}`, {
    params: { api_key: TMDB_API_KEY, language: 'pt-BR', append_to_response: `videos,${extra}` },
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

/**
 * Converte (temporada, episódio) do arquivo pra numeração do TMDB.
 * Animes como One Piece costumam vir com numeração ABSOLUTA (ep 1 a 1100+,
 * tudo "temporada 1"), mas no TMDB a série é dividida em temporadas/arcos
 * (S1 = 61 eps, S2 = 16 eps...). Sem converter, o ep 62 virava "S1E62", que
 * não existe no TMDB — ficava sem nome, sem imagem e na temporada errada.
 *
 * Trata como absoluto quando: não há temporada no nome, ou é temporada 1 com
 * número maior que a quantidade de episódios da temporada 1 no TMDB.
 */
function resolveEpisodeNumber(details, season, episode) {
  const seasons = (details?.seasons || [])
    .filter(s => s.season_number > 0 && s.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);
  if (!episode || seasons.length === 0) return { season: season || 1, episode, absolute: false };

  const current = seasons.find(s => s.season_number === (season || 1));
  const isAbsolute = !season || (season === 1 && current && episode > current.episode_count);
  if (!isAbsolute) return { season, episode, absolute: false };

  let remaining = episode;
  for (const s of seasons) {
    if (remaining <= s.episode_count) return { season: s.season_number, episode: remaining, absolute: true };
    remaining -= s.episode_count;
  }
  // Episódio mais novo que a contagem do TMDB: entra no fim da última temporada
  const last = seasons[seasons.length - 1];
  return { season: last.season_number, episode: last.episode_count + remaining, absolute: true };
}

async function saveMovie(details, fileUrl, version, dual = false) {
  const trailer = details.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');

  const movieData = {
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

  if (fileUrl) {
    movieData[`file_${version}`] = fileUrl;
    // Dual audio: mesmo arquivo serve para Dublado e Legendado (faixas diferentes)
    if (dual && version === 'dubbing') movieData.file_subtitled = fileUrl;
  }

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
    age_rating: extractAgeRating(details, 'series'),
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

async function saveEpisode(seriesId, tmdbId, season, episode, fileUrl, version, dual = false) {
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

  if (fileUrl) {
    epData[`file_${version}`] = fileUrl;
    if (dual && version === 'dubbing') epData.file_subtitled = fileUrl;
  }

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
    const filename = decodeURIComponent(fileUrl.split('/').pop());

    console.log(`\nProcessando: ${filename}`);

    try {
      const { type, name, season, episode, year } = extractInfo(filename);
      const version = forcedVersion || detectVersion(filename);
      const dual = isDualAudio(filename);

      console.log(`  Tipo: ${type} | Nome: "${name}" | Ano: ${year} | Temp: ${season} | Ep: ${episode} | Versão: ${version}${dual ? ' | DUAL AUDIO' : ''}`);

      const tmdbResult = await searchTMDB(name, type, year);

      if (!tmdbResult) {
        console.log('  Não encontrado no TMDB');
        report.notFound.push({ filename, name });
        continue;
      }

      console.log(`  Encontrado: "${tmdbResult.title || tmdbResult.name}" (ID: ${tmdbResult.id})`);

      const details = await getDetails(tmdbResult.id, type);

      if (type === 'movie') {
        const saved = await saveMovie(details, fileUrl, version, dual);
        report.success.push({ filename, fileUrl, type: 'movie', title: saved.title, id: saved.id, dual });
        // Busca legendas em background (não bloqueia a resposta)
        autoFetchSubtitles({ movieId: saved.id, tmdbId: saved.tmdb_id, movieType: 'movie' })
          .catch(e => console.warn('  [subtitles] movie:', e.message));
      } else {
        const seriesRecord = await saveSeries(details);
        let finalSeason = season;
        let finalEpisode = episode;
        if (episode) {
          const r = resolveEpisodeNumber(details, season, episode);
          finalSeason = r.season;
          finalEpisode = r.episode;
          if (r.absolute) console.log(`  Numeração absoluta: ep ${episode} → T${finalSeason}E${finalEpisode}`);
          const savedEp = await saveEpisode(seriesRecord.id, details.id, finalSeason, finalEpisode, fileUrl, version, dual);
          autoFetchSubtitles({
            movieId: savedEp.id, tmdbId: details.id, movieType: 'episode',
            seasonNumber: finalSeason, episodeNumber: finalEpisode,
          }).catch(e => console.warn('  [subtitles] episode:', e.message));
        }
        report.success.push({ filename, fileUrl, type: 'series', title: details.name, seriesId: seriesRecord.id, season: finalSeason, episode: finalEpisode, dual });
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

module.exports = { processFiles, detectType, extractInfo, resolveEpisodeNumber, getDetails, getEpisodeDetails };

// Uso via CLI: node tmdb-bot.js "URL1" "URL2"
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Uso: node tmdb-bot.js "URL1" "URL2" ...');
    process.exit(1);
  }
  processFiles(args).then(() => process.exit(0));
}
