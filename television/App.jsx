import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ProfileProvider, useProfile } from './src/contexts/ProfileContext';

// Exibe notificações mesmo com o app em primeiro plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import DetailScreen from './src/screens/DetailScreen';
import PlayerScreen from './src/screens/PlayerScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import IptvScreen from './src/screens/IptvScreen';
import ProfileSelectScreen from './src/screens/ProfileSelectScreen';

const Stack = createStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#000' },
};

// Garante que, uma vez logado, sempre exista um perfil ativo antes de
// deixar navegar pro resto do app — mesmo comportamento do app mobile.
function ProfileGate({ navigation }) {
  const { activeProfile } = useProfile();

  React.useEffect(() => {
    if (!activeProfile) {
      navigation.reset({ index: 0, routes: [{ name: 'ProfileSelect' }] });
    }
  }, [activeProfile]);

  return null;
}

function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animationEnabled: false,
          cardStyle: { backgroundColor: '#000' },
        }}
        initialRouteName={user ? 'Home' : 'Login'}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ProfileSelect" component={ProfileSelectScreen} />
        <Stack.Screen name="Home">
          {props => <><ProfileGate {...props} /><HomeScreen {...props} /></>}
        </Stack.Screen>
        <Stack.Screen name="Detail" component={DetailScreen} />
        <Stack.Screen name="Player" component={PlayerScreen} />
        <Stack.Screen name="Subscription" component={SubscriptionScreen} />
        <Stack.Screen name="Iptv" component={IptvScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ ...Ionicons.font });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#E50914" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ProfileProvider>
          <AppNavigator />
        </ProfileProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
