const { withAppBuildGradle } = require('@expo/config-plugins');

// A dependência do Chromecast usa versão "+" e passou a puxar
// androidx.mediarouter 1.9.0-beta01, que exige compileSdk 37 / AGP 9.1 e
// quebra o build. Fixa uma versão estável compatível.
const MARKER = '// withPinnedMediarouter';

module.exports = function withPinnedMediarouter(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += `
${MARKER}
configurations.all {
    resolutionStrategy {
        force 'androidx.mediarouter:mediarouter:1.7.0'
    }
}
`;
    }
    return cfg;
  });
};
