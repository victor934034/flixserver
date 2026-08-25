const { sendPushToAll } = require('./notifications');

// Notifica conteudo novo a partir do relatorio de processFiles() (tmdb-bot.js)
// { success: [], notFound: [], errors: [] } — usado pelos caminhos que
// importam sem passar pela busca manual em /tmdb/import/:tmdbId (que ja
// notifica por conta propria): /tmdb/detect, /tmdb/batch e
// /admin/scan-bucket/import.
function notifyImportReport(supabase, report) {
  const movies = (report.success || []).filter(r => r.type === 'movie');
  if (movies.length === 1) {
    sendPushToAll(supabase, `🎬 ${movies[0].title}`, 'Novo filme adicionado!', { screen: 'filme', id: movies[0].id }).catch(() => {});
  } else if (movies.length > 1) {
    sendPushToAll(supabase, '🎬 Novos filmes adicionados!', `${movies.length} filmes foram adicionados`).catch(() => {});
  }

  const episodesBySeries = {};
  for (const r of (report.success || []).filter(r => r.type === 'series' && r.season && r.episode)) {
    const key = r.seriesId || r.title;
    if (!episodesBySeries[key]) episodesBySeries[key] = { title: r.title, seriesId: r.seriesId, eps: [] };
    episodesBySeries[key].eps.push(r);
  }
  for (const { title, seriesId, eps } of Object.values(episodesBySeries)) {
    const body = eps.length === 1
      ? `T${eps[0].season}E${String(eps[0].episode).padStart(2, '0')} disponível`
      : `${eps.length} episódios foram adicionados`;
    sendPushToAll(supabase, `📺 ${title}`, body, { screen: 'serie', id: seriesId }).catch(() => {});
  }
}

module.exports = { notifyImportReport };
