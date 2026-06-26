/**
 * Parseia uma string M3U e retorna lista de canais.
 * Suporta atributos: tvg-name, tvg-logo, tvg-id, group-title
 */
export function parseM3U(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const channels = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      const name  = line.match(/,(.+)$/)              ?.[1]?.trim() ?? 'Sem nome';
      const logo  = line.match(/tvg-logo="([^"]+)"/)  ?.[1] ?? null;
      const group = line.match(/group-title="([^"]+)/)?.[1] ?? 'Geral';
      const id    = line.match(/tvg-id="([^"]+)"/)    ?.[1] ?? null;
      current = { name, logo, group, id, url: null };
    } else if (current && !line.startsWith('#')) {
      current.url = line;
      channels.push(current);
      current = null;
    }
  }

  return channels;
}

/** Agrupa canais por group-title */
export function groupChannels(channels) {
  const map = {};
  for (const ch of channels) {
    if (!map[ch.group]) map[ch.group] = [];
    map[ch.group].push(ch);
  }
  return Object.entries(map).map(([group, items]) => ({ group, items }));
}
