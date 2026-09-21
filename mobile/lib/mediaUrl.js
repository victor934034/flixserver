// URLs de vídeo guardadas no banco foram geradas com encodeURIComponent no
// caminho INTEIRO, então as barras das pastas viraram %2F
// (".../series%2FNome%2FTemporada01%2Fep.mp4"). Alguns Androids/ExoPlayer
// decodificam %2F e remontam a URL com "/" (ou o contrário) e o CDN responde
// 404 só nesses aparelhos. A forma com "/" reais é a que o CDN serve certinho.

function split(url) {
  const q = url.indexOf('?');
  const base = q >= 0 ? url.slice(0, q) : url;
  const qs = q >= 0 ? url.slice(q) : '';
  const m = base.match(/^(https?:\/\/[^/]+)(\/.*)?$/i);
  return m ? { origin: m[1], path: m[2] || '', qs } : null;
}

export function normalizeMediaUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return url;
  const p = split(url);
  return p ? p.origin + p.path.replace(/%2F/gi, '/') + p.qs : url;
}

// Forma alternativa (a "outra" que o servidor pode estar esperando): com
// barras => tudo num segmento só (%2F), e vice-versa. Usada como 2ª tentativa
// quando o player dá 404.
export function altMediaUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return url;
  const p = split(url);
  if (!p) return url;
  const hasEncodedSlash = /%2F/i.test(p.path);
  if (hasEncodedSlash) return p.origin + p.path.replace(/%2F/gi, '/') + p.qs;
  const rel = p.path.replace(/^\//, '');
  if (!rel.includes('/')) return url;
  let decoded = rel;
  try { decoded = decodeURIComponent(rel); } catch {}
  return p.origin + '/' + encodeURIComponent(decoded) + p.qs;
}

export function normalizeVersions(versions) {
  const out = {};
  Object.keys(versions || {}).forEach(k => { out[k] = normalizeMediaUrl(versions[k]); });
  return out;
}
