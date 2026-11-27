// Ligação entre o passo a passo e o resto do site.
export const OPEN_EVENT = 'flixhome:tutorial';
export const SURPRISE_EVENT = 'flixhome:surpresa';
let pendingSurprise = false;

export function openTutorial() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

// "Surpreenda-me" do último passo: se a Home ainda não montou, o botão pega ao montar
export function requestSurprise() {
  pendingSurprise = true;
  window.dispatchEvent(new Event(SURPRISE_EVENT));
}

export function consumeSurprise() {
  const was = pendingSurprise;
  pendingSurprise = false;
  return was;
}
