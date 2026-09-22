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

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Content-Type',
          'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    const url = new URL(request.url);
    const backblazeUrl = `https://f005.backblazeb2.com/file/Flixhome${url.pathname}`;

    const fetchHeaders = {};
    const range = request.headers.get('Range');
    if (range) fetchHeaders['Range'] = range;

    const response = await fetch(backblazeUrl, {
      headers: fetchHeaders,
      cf: {
        // Só cacheia resposta de SUCESSO (200/206). Sem isso, um 404 passageiro
        // da B2 (upload ainda propagando, timeout etc.) pode ficar guardado em
        // cache por horas em cada ponto de presença da Cloudflare separadamente
        // — explica "funciona no meu celular mas não no do meu amigo": PoPs
        // diferentes, um guardou o 404 ruim, o outro nunca viu erro e serve normal.
        cacheEverything: true,
        cacheTtlByStatus: {
          '200-299': 86400,
          '300-399': 0,
          '400-599': 0,
        },
      },
    });

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type');
    newHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');
    newHeaders.set('Accept-Ranges', 'bytes');

    // ← ESSENCIAL: força o Content-Type correto pelo nome do arquivo
    // O B2 retorna application/octet-stream para vídeos, o que quebra o áudio AAC no browser
    const ext = url.pathname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
    if (MIME[ext]) newHeaders.set('Content-Type', MIME[ext]);

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  }
}
