// Regras do "Pular abertura" e do "Próximo episódio" (tempos em segundos).
// Mesma regra em todas as plataformas.

// Só enquanto a abertura toca. Tempo maior que o vídeo é de outro corte: ignora.
export function introVisible(times, pos, dur) {
  if (!times || !times.intro_end) return false;
  if (dur > 0 && times.intro_end >= dur * 0.6) return false;
  return pos >= (times.intro_start || 0) && pos < times.intro_end - 1;
}

// Início dos créditos, só se fizer sentido pra duração deste arquivo:
// um dado errado não pode cortar o episódio no meio. null = sem dado.
export function creditsStart(times, dur) {
  const c = times && times.credits_start;
  return c && dur > 0 && c >= dur * 0.6 && c < dur - 3 ? c : null;
}
