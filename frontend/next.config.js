/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'cineflix.victorlima0978.workers.dev' },
      { protocol: 'https', hostname: 'cineflix-cdn.victorlima0978.workers.dev' },
    ],
    // As imagens já vêm prontas de um CDN (TMDB ou nosso Worker) — reotimizar de
    // novo aqui só adiciona um ponto de falha: se o servidor tiver qualquer
    // engasgo de rede pra alcançar esses hosts, a imagem inteira quebra
    // (era a causa dos "fetch failed / ETIMEDOUT" nos logs).
    unoptimized: true,
  },
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        // microfone liberado só pro próprio site (chat de voz do "Assistir juntos")
        { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
      ],
    }];
  },
  async rewrites() {
    return [
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:3001/socket.io/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
