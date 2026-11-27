// Ligação entre o passo a passo e o resto do app.
const listeners = {};

function on(name, fn) {
  listeners[name] = fn;
  return () => { if (listeners[name] === fn) delete listeners[name]; };
}
const emit = name => listeners[name]?.();

export const openTutorial = () => emit('open');
export const onOpenTutorial = fn => on('open', fn);
// Atalhos do último passo: voltar ao Início e abrir o Surpreenda-me
export const requestHome = () => emit('home');
export const onHome = fn => on('home', fn);
export const requestSurprise = () => emit('surprise');
export const onSurprise = fn => on('surprise', fn);
