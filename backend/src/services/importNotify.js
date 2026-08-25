const { sendPush, sendPushToAll } = require('./notifications');

// Avisa só as contas admin (nunca todo mundo) quando um upload terminou mas
// NAO foi importado — arquivo nao encontrado no TMDB ou erro no processo.
// So o admin precisa saber disso pra completar o cadastro manualmente.
async function notifyAdminsImportFailed(supabase, report) {
  const notFound = report.notFound || [];
  const errors = report.errors || [];
  if (!notFound.length && !errors.length) return;

  try {
    const { data: admins } = await supabase
      .from('users')
      .select('push_token')
      .eq('is_admin', true)
      .not('push_token', 'is', null);
    const tokens = (admins || []).map(a => a.push_token).filter(Boolean);
    if (!tokens.length) return;

    const total = notFound.length + errors.length;
    const title = '⚠️ Upload não importado';
    const body = total === 1
      ? `"${(notFound[0] || errors[0])?.filename}" precisa de importação manual.`
      : `${total} arquivo(s) enviados não foram importados automaticamente e precisam de atenção.`;
    await sendPush(tokens, title, body, { screen: 'admin-importar' });
  } catch (e) {
    console.error('[importNotify] notifyAdminsImportFailed erro:', e.message);
  }
}

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

  notifyAdminsImportFailed(supabase, report).catch(() => {});
}

module.exports = { notifyImportReport };
