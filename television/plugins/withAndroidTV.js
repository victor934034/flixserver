// Prepara o app para o Android TV / Google Play TV:
//  - declara o recurso "leanback" e que touchscreen não é obrigatório
//  - adiciona a categoria LEANBACK_LAUNCHER (aparece na tela inicial da TV)
//  - define o banner (320x180) usado no launcher da TV
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withBanner = (config) => withDangerousMod(config, ['android', async (cfg) => {
  const src = path.join(cfg.modRequest.projectRoot, 'assets', 'tv-banner.png');
  const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'drawable-xhdpi');
  if (fs.existsSync(src)) {
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, path.join(dir, 'tv_banner.png'));
  }
  return cfg;
}]);

module.exports = function withAndroidTV(config) {
  config = withAndroidManifest(config, (cfg) => {
    const m = cfg.modResults.manifest;

    m['uses-feature'] = m['uses-feature'] || [];
    const has = (n) => m['uses-feature'].some(f => f.$['android:name'] === n);
    if (!has('android.software.leanback')) m['uses-feature'].push({ $: { 'android:name': 'android.software.leanback', 'android:required': 'true' } });
    if (!has('android.hardware.touchscreen')) m['uses-feature'].push({ $: { 'android:name': 'android.hardware.touchscreen', 'android:required': 'false' } });
    // microfone/câmera/telefone não existem na maioria das TVs
    ['android.hardware.microphone', 'android.hardware.camera', 'android.hardware.telephony'].forEach(n => {
      if (!has(n)) m['uses-feature'].push({ $: { 'android:name': n, 'android:required': 'false' } });
    });

    const app = m.application[0];
    app.$['android:banner'] = '@drawable/tv_banner';

    const main = (app.activity || []).find(a => a.$['android:name'] === '.MainActivity') || (app.activity || [])[0];
    if (main) {
      main['intent-filter'] = main['intent-filter'] || [];
      const launcher = main['intent-filter'].find(f => (f.category || []).some(c => c.$['android:name'] === 'android.intent.category.LAUNCHER'));
      if (launcher && !(launcher.category || []).some(c => c.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER')) {
        launcher.category.push({ $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' } });
      }
    }
    return cfg;
  });
  return withBanner(config);
};
