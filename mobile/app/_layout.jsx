import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { DownloadProvider } from '../contexts/DownloadContext';
import { ParentalProvider } from '../contexts/ParentalContext';
import { ProfileProvider, useProfile } from '../contexts/ProfileContext';
import api from '../lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }),
});

async function requestNotificationPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') await Notifications.requestPermissionsAsync();
}

async function registerPushToken() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    if (token) await api.post('/auth/push-token', { token });
  } catch {}
}

function AppGate() {
  const { token, user, loading } = useAuth();
  const { activeProfile, loadSavedProfile } = useProfile();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!navState?.key || loading) return;

    const inAuth = segments[0] === '(auth)';
    const onProfileSelect = segments[0] === 'profile-select';
    const onSubscription = segments[0] === 'subscription';

    if (!token) {
      if (!inAuth) router.replace('/(auth)/login');
      return;
    }

    // Logado — registra push token uma vez
    if (!checkedRef.current) {
      checkedRef.current = true;
      registerPushToken();
    }

    if (inAuth) { router.replace('/(tabs)'); return; }

    // Verifica assinatura quando o usuário está nas tabs
    if (segments[0] === '(tabs)' && !onSubscription) {
      api.get('/settings').then(({ data }) => {
        if (data.subscription_enabled === 'true') {
          const now = Date.now();
          const hasValid = user?.plan && user?.plan_expires_at && new Date(user.plan_expires_at).getTime() > now;
          if (!hasValid) router.replace('/subscription');
        }
      }).catch(() => {});
    }
  }, [token, loading, segments, navState?.key]);

  // Gate de perfil: logado, não está em auth/subscription, sem perfil ativo → selecionar perfil
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
                  <Stack.Screen name="subscription" />
                  <Stack.Screen name="filme/[id]" />
                  <Stack.Screen name="serie/[id]" />
                  <Stack.Screen name="historico" />
                  <Stack.Screen name="parental-controls" />
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
