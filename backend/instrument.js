// Monitoramento de erros em produção (Sentry) — precisa ser o PRIMEIRO
// require de todo o processo, antes de qualquer outra coisa (inclusive
// express), pra conseguir instrumentar tudo automaticamente.
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: 'https://4a0aab952f111a9bd33fed632d4dd952@o4512189153345536.ingest.us.sentry.io/4512189301719040',
  tracesSampleRate: 0, // só erro, sem tracing/performance (evita gastar cota à toa)
});
