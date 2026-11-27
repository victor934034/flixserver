// Ligação entre o passo a passo e o resto do app.
let openListener = null;
let surpriseListener = null;
let pendingSurprise = false;

export function openTutorial() {
  openListener?.();
}

export function onOpenTutorial(fn) {
  openListener = fn;
  return () => { if (openListener === fn) openListener = null; };
}

// "Surpreenda-me" do último passo: se a Home ainda não montou, o sorteio abre ao montar
export function requestSurprise() {
  if (surpriseListener) surpriseListener();
  else pendingSurprise = true;
}

export function onSurprise(fn) {
  surpriseListener = fn;
  if (pendingSurprise) { pendingSurprise = false; fn(); }
  return () => { if (surpriseListener === fn) surpriseListener = null; };
}
