import { Linking, Alert } from 'react-native';

const PACKAGE = 'com.flixhome.app';

// Abre a página do app na loja (o link "market://" abre direto o app da Play Store).
// Não usa módulo nativo, então chega por atualização automática, sem build novo.
export async function openStoreRating() {
  try {
    await Linking.openURL(`market://details?id=${PACKAGE}`);
  } catch {
    try { await Linking.openURL(`https://play.google.com/store/apps/details?id=${PACKAGE}`); }
    catch { Alert.alert('Avaliar', 'Não foi possível abrir a Play Store.'); }
  }
}
