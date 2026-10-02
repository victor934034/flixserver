const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// getSentryExpoConfig já envolve a config padrão do Expo e injeta o plugin
// de Metro do Sentry (anotação de source map pra stack trace ficar legível
// em produção, já que o bundle é minificado).
const config = getSentryExpoConfig(__dirname);

module.exports = config;
