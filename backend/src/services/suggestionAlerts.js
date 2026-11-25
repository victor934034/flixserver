const { sendPush } = require('./notifications');

// "Aviso de pedido atendido": quando entra no catálogo um título que alguém
// sugeriu, a sugestão vira "added" e quem pediu é avisado.

const MOVIE_FILES = ['file_dubbing', 'file_subtitled', 'file_cinema', 'file_4k', 'file_color', 'file_bw'];
const EPISODE_FILES = ['file_dubbing', 'file_subtitled', 'file_cinema', 'file_color', 'file_bw'];
const hasFile = (row, cols) => cols.some(c => row[c]);

// Procura no catálogo o título da sugestão (pelo id do TMDB), já com vídeo.
// Retorna { id, title, content_type, created_at } ou null.
async function findInCatalog(supabase, suggestion) {
  if (!suggestion.tmdb_id) return null;
  const isSeries = suggestion.type === 'series' || suggestion.type === 'tv';

  if (!isSeries) {
    const { data } = await supabase.from('movies')
      .select(`id, title, created_at, ${MOVIE_FILES.join(', ')}`)
      .eq('tmdb_id', suggestion.tmdb_id).eq('is_active', true).limit(1);
    const movie = data?.[0];
    return movie && hasFile(movie, MOVIE_FILES)
      ? { id: movie.id, title: movie.title, content_type: 'movie', created_at: movie.created_at }
      : null;
  }

  const { data } = await supabase.from('series')
    .select('id, title, created_at').eq('tmdb_id', suggestion.tmdb_id).eq('is_active', true).limit(1);
  const serie = data?.[0];
  if (!serie) return null;
  const { data: eps } = await supabase.from('episodes')
    .select(EPISODE_FILES.join(', ')).eq('series_id', serie.id).eq('is_active', true).limit(50);
  return (eps || []).some(e => hasFile(e, EPISODE_FILES))
    ? { id: serie.id, title: serie.title, content_type: 'series', created_at: serie.created_at }
    : null;
}

async function pushArrived(supabase, suggestion, content) {
  const { data: user } = await supabase.from('users')
    .select('push_token, notification_prefs').eq('id', suggestion.user_id).maybeSingle();
  if (!user?.push_token || user.notification_prefs?.new_content === false) return;
  await sendPush(
    [user.push_token],
    '🎉 Seu pedido chegou!',
    `"${content?.title || suggestion.title}" já está no FlixHome.`,
    content ? { screen: content.content_type === 'movie' ? 'filme' : 'serie', id: content.id } : {}
  );
}

// Marca como atendida e avisa. A atualização condicional garante um aviso só,
// mesmo que o admin e a rotina automática passem pela mesma sugestão.
async function markAdded(supabase, suggestion, content, note) {
  const patch = { status: 'added', updated_at: new Date().toISOString() };
  if (note !== undefined) patch.admin_note = note;
  const { data: changed, error } = await supabase.from('suggestions')
    .update(patch).eq('id', suggestion.id).neq('status', 'added').select('id');
  if (error) throw error;
  if (!changed?.length) return false;
  await pushArrived(supabase, suggestion, content);
  return true;
}

// Rotina periódica. Só vale conteúdo cadastrado DEPOIS da sugestão: o que já
// existia no catálogo não dispara aviso atrasado em massa.
async function checkFulfilledSuggestions(supabase) {
  const { data: open, error } = await supabase.from('suggestions')
    .select('id, user_id, title, type, tmdb_id, status, created_at')
    .in('status', ['pending', 'approved'])
    .not('tmdb_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;

  let sent = 0;
  for (const s of open || []) {
    const content = await findInCatalog(supabase, s);
    if (!content || new Date(content.created_at) < new Date(s.created_at)) continue;
    if (await markAdded(supabase, s, content)) sent++;
  }
  if (sent) console.log(`[sugestões] ${sent} pedido(s) atendido(s)`);
  return sent;
}

module.exports = { checkFulfilledSuggestions, findInCatalog, markAdded };
