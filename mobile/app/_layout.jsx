import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { DownloadProvider } from '../contexts/DownloadContext';
import { ParentalProvider } from '../contexts/ParentalContext';
import { ProfileProvider, useProfile } from '../contexts/ProfileContext';
import api from '../lib/api';

// Expo Go no SDK 53 não suporta push notifications — só registra em builds nativos
const isExpoGo = Constants.appOwnership === 'expo';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }),
});

async function requestNotificationPermission() {
  if (isExpoGo) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') await Notifications.requestPermissionsAsync();
  } catch {}
}

async function registerPushToken() {
  if (isExpoGo) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? '003e6f97-72d9-49d4-a9aa-2360f01b3fcf';
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token) await api.post('/auth/push-token', { token });
  } catch (e) {
    console.warn('[push] registerPushToken:', e.message);
  }
}

async function checkSubscription(user, router) {
  if (user?.is_admin) return;
  try {
    const { data } = await api.get('/settings');
    if (data.subscription_enabled !== 'true') return;
    let freshUser = user;
    try {
      const meRes = await api.get('/auth/me');
      if (meRes.data?.id) freshUser = meRes.data;
    } catch {}
    const now = Date.now();
    const hasValid = freshUser?.plan && freshUser?.plan_expires_at
      && new Date(freshUser.plan_expires_at).getTime() > now;
    if (!hasValid) router.replace('/subscription');
  } catch {}
}

function AppGate() {
  const { token, user, loading } = useAuth();
  const { activeProfile } = useProfile();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();
  const checkedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  // Verifica assinatura ao navegar entre telas
  useEffect(() => {
    if (!navState?.key || loading) return;

    const inAuth = segments[0] === '(auth)';
    const onProfileSelect = segments[0] === 'profile-select';
    const onSubscription = segments[0] === 'subscription';

    if (!token) {
      if (!inAuth) router.replace('/(auth)/login');
      return;
    }

    if (!checkedRef.current) {
      checkedRef.current = true;
      registerPushToken();
    }

    if (inAuth) { router.replace('/(tabs)'); return; }

    if (!onSubscription && !onProfileSelect) {
      checkSubscription(user, router);
    }
  }, [token, loading, segments, navState?.key]);

  // Re-verifica assinatura ao voltar do background (app minimizado → foreground)
  useEffect(() => {
    if (!token || loading) return;
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        const onSubscription = segments[0] === 'subscription';
        const onProfileSelect = segments[0] === 'profile-select';
        if (!onSubscription && !onProfileSelect) {
          checkSubscription(user, router);
        }
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [token, loading, user, segments]);

  // Gate de perfil
  useEffect(() => {
    if (!navState?.key || loading || !token) return;
    const inAuth = segments[0] === '(auth)';
    const onSub = segments[0] === 'subscription';
    const onPS = segments[0] === 'profile-select';
    if (!inAuth && !onSub && !onPS && !activeProfile) {
      router.replace('/profile-select');
    }
  }, [token, loading, segments, navState?.key, activeProfile]);

  return null;
}

export default function RootLayout() {
  useEffect(() => { requestNotificationPermission(); }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ProfileProvider>
            <DownloadProvider>
              <ParentalProvider>
                <AppGate />
                <StatusBar style="light" />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' } }}>
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(auth)/forgot-password" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="profile-select" />
                  <Stack.Screen name="subscription" options={{ gestureEnabled: false }} />
                  <Stack.Screen name="filme/[id]" />
                  <Stack.Screen name="serie/[id]" />
                  <Stack.Screen name="historico" />
                  <Stack.Screen name="parental-controls" />
                  <Stack.Screen name="sugestao" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="player" options={{ animation: 'fade', gestureEnabled: false }} />
                </Stack>
              </ParentalProvider>
            </DownloadProvider>
          </ProfileProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
