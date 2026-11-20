// ID estável do aparelho, usado só para impedir abuso do teste grátis.
// (O IMEI não é acessível a apps comuns no Android 10+/iOS — este é o melhor ID disponível.)
// Android: ANDROID_ID (muda só com reset de fábrica) | iOS: identifierForVendor.
// Fallback: UUID gerado e guardado na instalação.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

let cached = null;

function uuid() {
  return 'inst-' + 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function getDeviceId() {
  if (cached) return cached;
  try {
    const App = require('expo-application');
    let id = null;
    if (Platform.OS === 'android') id = App.getAndroidId ? App.getAndroidId() : App.androidId;
    else if (Platform.OS === 'ios') id = await App.getIosIdForVendorAsync();
    if (id && String(id).length >= 8) return (cached = `${Platform.OS}:${id}`);
  } catch {}
  try {
    let id = await AsyncStorage.getItem('device_install_id');
    if (!id) { id = uuid(); await AsyncStorage.setItem('device_install_id', id); }
    return (cached = id);
  } catch {
    return (cached = uuid());
  }
}

export const platformName = () => (Platform.OS === 'ios' ? 'ios' : 'android');
