// Ligação entre o passo a passo e o resto do app.
export const OPEN_EVENT = 'flixhome:tutorial';
export const SURPRISE_EVENT = 'flixhome:surpresa';
export const HOME_EVENT = 'flixhome:inicio';

export function openTutorial() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}
