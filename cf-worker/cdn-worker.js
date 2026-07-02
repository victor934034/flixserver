/**
 * Cloudflare Worker CDN para Flixhome
 *
 * Como usar:
 * 1. Acesse https://dash.cloudflare.com → Workers & Pages → seu worker
 * 2. Clique em "Edit Code" e substitua todo o código por este arquivo
 * 3. Adicione a variável de ambiente B2_DOWNLOAD_URL nas Settings do Worker
 *    Exemplo: https://f005.backblazeb2.com/file/Flixhome
 * 4. Salve e faça Deploy
 *
 * Este worker garante:
 * - Content-Type correto para cada tipo de arquivo (ESSENCIAL para áudio AAC no browser)
 * - Suporte a Range requests (ESSENCIAL para seeking no vídeo)
 * - Headers CORS corretos para crossOrigin="anonymous" no player
 * - Repassa Content-Range e Content-Length do B2
 */

const MIME = {
  '.mp4':  'video/mp4',
  '.m4v':  'video/mp4',
  '.mkv':  'video/x-matroska',
  '.webm': 'video/webm',
  '.mov':  'video/quicktime',
  '.avi':  'video/x-msvideo',
  '.vtt':  'text/vtt; charset=utf-8',
  '.srt':  'text/plain; charset=utf-8',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':   '*',
  'Access-Control-Allow-Methods':  'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers':  'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
  'Access-Control-Max-Age':        '86400',
};

export default {
  async fetch(request, env) {
    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // URL do arquivo no B2
    const b2Base = (env.B2_DOWNLOAD_URL || '').replace(/\/$/, '');
    const b2Url  = `${b2Base}${pathname}`;

    // Repassa Range header do browser para o B2
    const reqHeaders = new Headers();
    if (request.headers.has('Range')) {
      reqHeaders.set('Range', request.headers.get('Range'));
    }

    // Cache agressivo no edge da Cloudflare para vídeos e subtítulos
    const isVideoPath = /\.(mp4|m4v|mkv|webm|mov|avi)$/i.test(pathname);
    const edgeCacheTtl = isVideoPath ? 86400 : 3600;

    let b2Res;
    try {
      b2Res = await fetch(b2Url, {
        headers: reqHeaders,
        method: request.method,
        cf: { cacheEverything: true, cacheTtl: edgeCacheTtl },
      });
    } catch (e) {
      return new Response('Origin fetch failed: ' + e.message, { status: 502, headers: CORS_HEADERS });
    }

    // Detecta o MIME pelo path (não confia no Content-Type do B2 que pode vir errado)
    const ext = pathname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
    const contentType = MIME[ext] ?? b2Res.headers.get('Content-Type') ?? 'application/octet-stream';

    // Monta headers da resposta
    const resHeaders = new Headers(CORS_HEADERS);
    resHeaders.set('Content-Type', contentType);
    resHeaders.set('Accept-Ranges', 'bytes');

    // Repassa headers importantes vindos do B2
    for (const h of ['Content-Length', 'Content-Range', 'Last-Modified', 'ETag']) {
      const v = b2Res.headers.get(h);
      if (v) resHeaders.set(h, v);
    }

    // Cache no cliente: vídeos 24h, outros 5min
    const isVideo = contentType.startsWith('video/');
    resHeaders.set('Cache-Control', isVideo ? 'public, max-age=86400' : 'public, max-age=300');

    return new Response(b2Res.body, {
      status: b2Res.status,    // 200 ou 206 (partial content para range requests)
      headers: resHeaders,
    });
  },
};
