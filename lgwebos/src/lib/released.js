// Recém lançados (filmes + séries pela data real de lançamento) e episódios recentes
export function mergeReleased(movies, series) {
  const all = [...(movies || []), ...(series || [])];
  return all
    .sort((a, b) => String(b.release_date || '').localeCompare(String(a.release_date || '')))
    .slice(0, 20);
}

// Episódio recente vira card da série (abre a série)
export function mapRecentEpisodes(list) {
  const seen = new Set();
  const out = [];
  for (const e of list || []) {
    if (!e.series_id || seen.has(e.series_id)) continue;
    seen.add(e.series_id);
    out.push({
      id: e.series_id,
      title: e.series_title + ' · T' + e.season_number + 'E' + String(e.episode_number).padStart(2, '0'),
      poster_url: e.poster_url,
      total_seasons: 1,
    });
  }
  return out;
}
