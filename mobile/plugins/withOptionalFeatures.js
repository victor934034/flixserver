// Evita que a Play Store restrinja o app por recursos de hardware "obrigatórios" (wifi, retrato)
const { withAndroidManifest } = require('@expo/config-plugins');
module.exports = (config) => withAndroidManifest(config, (cfg) => {
  const m = cfg.modResults.manifest;
  m['uses-feature'] = m['uses-feature'] || [];
  for (const n of ['android.hardware.screen.portrait', 'android.hardware.wifi', 'android.hardware.screen.landscape', 'android.hardware.touchscreen']) {
    const f = m['uses-feature'].find(x => x.$['android:name'] === n);
    if (f) f.$['android:required'] = 'false';
    else m['uses-feature'].push({ $: { 'android:name': n, 'android:required': 'false' } });
  }
  return cfg;
});
