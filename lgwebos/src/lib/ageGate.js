// Classificação do app na LG Content Store: até 14 anos.
// Esta versão esconde o que passa disso — títulos 16+/18+, títulos sem
// classificação, canais/categorias de IPTV adulto e os planos "com adulto".
export const MAX_AGE = 14;
const HIDE_UNRATED = true; // título sem classificação não pode ser garantido como ≤ 14

export function ageOk(v) {
  if (v == null || String(v).trim() === '') return !HIDE_UNRATED;
  const s = String(v).trim().toUpperCase();
  if (/^(L|LIVRE|ER|G|TV-G|TV-Y|TV-Y7|PG|TV-PG|PG-13|TV-14)$/.test(s)) return true;
  const n = parseInt(s, 10);
  if (!isNaN(n)) return n <= MAX_AGE;
  return false; // R, TV-MA, NC-17, NR... e qualquer valor desconhecido
}

const ADULT_NAME = /adult|xxx|\+\s?18|18\s?\+|porn|sexy|sex\b|erot|playboy|hustler|venus|brazzers/i;

function filterList(arr, url) {
  return arr.filter(it => {
    if (!it || typeof it !== 'object') return true;
    if ('age_rating' in it) return ageOk(it.age_rating);
    if (url.indexOf('/api/iptv/categories') >= 0) return !ADULT_NAME.test(it.category_name || '');
    if (url.indexOf('/api/iptv/streams') >= 0) return !ADULT_NAME.test(it.name || '');
    if (url.indexOf('/api/iptv/plans') >= 0) return !it.is_adult;
    return true;
  });
}

// Aplica o filtro em qualquer resposta: listas, {data:[...]} e {movies:[...], series:[...]}
export function ageFilter(url, data) {
  if (Array.isArray(data)) return filterList(data, url);
  if (data && typeof data === 'object') {
    const out = { ...data };
    ['data', 'movies', 'series', 'items', 'results'].forEach(k => {
      if (Array.isArray(out[k])) out[k] = filterList(out[k], url);
    });
    return out;
  }
  return data;
}
