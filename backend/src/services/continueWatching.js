// Tira um filme ou série do "Continuar assistindo": apaga só o que está pela
// metade (o concluído continua no histórico), apenas do usuário e perfil dados.
// Em série vale pra todos os episódios, senão outro pela metade voltaria.
async function removeFromContinue(supabase, { userId, profileId, type, id }) {
  let contentIds = [id];
  if (type === 'series') {
    const eps = [];
    for (let from = 0; ; from += 1000) { // o Supabase devolve no máximo 1000 por vez
      const { data, error } = await supabase.from('episodes').select('id').eq('series_id', id).order('id').range(from, from + 999);
      if (error) throw error;
      eps.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    contentIds = eps.map(e => e.id);
  }

  // Em lotes: séries longas estourariam o tamanho da URL do banco
  for (let i = 0; i < contentIds.length; i += 100) {
    let q = supabase.from('watch_history').delete()
      .eq('user_id', userId)
      .in('content_id', contentIds.slice(i, i + 100))
      .or('completed.is.null,completed.eq.false');
    q = profileId ? q.eq('profile_id', profileId) : q.is('profile_id', null);
    const { error } = await q;
    if (error) throw error;
  }
}

module.exports = { removeFromContinue };
