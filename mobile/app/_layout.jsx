import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
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

const isExpoGo = Constants.executionEnvironment === 'storeClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function setupAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Geral',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#E50914',
  });
}

async function registerPushToken() {
  const dbg = {
    execEnv: Constants.executionEnvironment,
    ownership: Constants.appOwnership,
    isExpoGo,
    step: 'start',
    error: null,
  };
  const sendDbg = () => api.post('/auth/push-debug', dbg).catch(() => {});

  if (isExpoGo) { dbg.step = 'skipped-expo-go'; sendDbg(); return; }

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    dbg.permStatus = existing;
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      dbg.permStatus = finalStatus;
    }
    if (finalStatus !== 'granted') { dbg.step = 'no-permission'; sendDbg(); return; }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? '77d031ac-6342-4017-8641-8376b1476a3b';
    dbg.projectId = projectId;
    dbg.step = 'getting-token';
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    dbg.tokenPrefix = token ? token.slice(0, 40) : null;
    dbg.step = token ? 'got-token' : 'no-token';

    if (token) {
      await api.post('/auth/push-token', { token });
      dbg.step = 'saved';
    }
  } catch (e) {
    dbg.step = 'error';
    dbg.error = e.message;
  }
  sendDbg();
}

async function checkSubscription(user, router) {
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

function handleNotificationTap(data, router) {
  if (!data || !router) return;
  try {
    const { screen, id } = data;
    if (screen === 'filme' && id) router.push(`/filme/${id}`);
    else if (screen === 'serie' && id) router.push(`/serie/${id}`);
    else if (screen === 'subscription') router.push('/subscription');
    else if (screen === 'iptv') router.push('/(tabs)/iptv');
    else if (screen === 'home') router.replace('/(tabs)');
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
  const notifCheckedRef = useRef(false);

  // Handle notification tap navigation (once nav is ready and user is logged in)
  useEffect(() => {
    if (!navState?.key || !token || loading) return;
    if (notifCheckedRef.current) return;
    notifCheckedRef.current = true;

    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response?.notification?.request?.content?.data) {
        handleNotificationTap(response.notification.request.content.data, router);
      }
    });

    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      handleNotificationTap(response.notification.request.content.data, router);
    });
    return () => sub.remove();
  }, [navState?.key, token, loading]);

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
  useEffect(() => {
    setupAndroidChannel();
  }, []);

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
                  <Stack.Screen name="player" options={{ animation: 'fade', gestureEnabled: false, orientation: 'landscape' }} />
                  <Stack.Screen name="iptv-channels" options={{ headerShown: false, animation: 'slide_from_right' }} />
                  <Stack.Screen name="iptv-player" options={{ headerShown: false, animation: 'fade', gestureEnabled: false, orientation: 'landscape' }} />
                  <Stack.Screen name="iptv-plans" options={{ headerShown: false, animation: 'slide_from_bottom', presentation: 'modal' }} />
                </Stack>
              </ParentalProvider>
            </DownloadProvider>
          </ProfileProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
