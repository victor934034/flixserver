// Filtros de data de lançamento (iguais no app, site e TV)
const year = new Date().getFullYear();
export const DATE_PRESETS = [
  { key: '', label: 'Qualquer data' },
  { key: '30d', label: 'Últimos 30 dias' },
  { key: '180d', label: 'Últimos 6 meses' },
  { key: 'year', label: `Este ano (${year})` },
  { key: '2020s', label: 'Anos 2020' },
  { key: '2010s', label: 'Anos 2010' },
  { key: '2000s', label: 'Anos 2000' },
  { key: '1990s', label: 'Anos 90' },
];

// Converte o preset em parâmetros de query da API
export function presetQuery(key) {
  switch (key) {
    case '30d': return '&released_days=30';
    case '180d': return '&released_days=180';
    case 'year': return `&year_from=${year}&year_to=${year}`;
    case '2020s': return '&year_from=2020&year_to=2029';
    case '2010s': return '&year_from=2010&year_to=2019';
    case '2000s': return '&year_from=2000&year_to=2009';
    case '1990s': return '&year_from=1990&year_to=1999';
    default: return '';
  }
}
