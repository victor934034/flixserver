// Regras do "Pular abertura" e do "Próximo episódio" (tempos em segundos).
// Mesma regra em todas as plataformas. Os tempos vêm de voluntários e às vezes
// estão errados, então na dúvida o botão não aparece.

const INTRO_MAX_LENGTH = 240;   // abertura de mais de 4 minutos é dado errado
const CREDITS_MIN_RATIO = 0.85; // créditos só no fim do vídeo...
const CREDITS_MAX_TAIL = 420;   // ...e no máximo 7 minutos antes de acabar

// Só enquanto a abertura toca, e sempre na primeira metade do vídeo.
export function introVisible(times, pos, dur) {
  if (!times || !times.intro_end || !(dur > 0)) return false;
  const start = times.intro_start || 0;
  if (times.intro_end - start > INTRO_MAX_LENGTH || times.intro_end > dur * 0.5) return false;
  return pos >= start && pos < times.intro_end - 1;
}

// Início dos créditos, só se fizer sentido pra duração deste arquivo. null = sem dado.
export function creditsStart(times, dur) {
  const c = times && times.credits_start;
  return c && dur > 0 && c >= Math.max(dur * CREDITS_MIN_RATIO, dur - CREDITS_MAX_TAIL) && c < dur - 3 ? c : null;
}

// De onde retomar um episódio: quem já viu até o fim recomeça do zero.
export function resumeFrom(progress, duration, completed) {
  if (!(progress > 5) || completed || (duration > 0 && progress >= duration * 0.9)) return 0;
  return progress;
}
