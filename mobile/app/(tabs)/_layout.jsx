import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0a0a0a',
            borderTopColor: '#1f1f1f',
            borderTopWidth: 1,
            height: 52 + insets.bottom,
            paddingBottom: insets.bottom + 4,
            paddingTop: 6,
          },
          tabBarActiveTintColor: '#E50914',
          tabBarInactiveTintColor: '#444',
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="filmes"
          options={{
            title: 'Filmes',
            tabBarIcon: ({ color, size }) => <Ionicons name="film" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="series"
          options={{
            title: 'Séries',
            tabBarIcon: ({ color, size }) => <Ionicons name="tv" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="busca"
          options={{
            title: 'Buscar',
            tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="downloads"
          options={{
            title: 'Downloads',
            tabBarIcon: ({ color, size }) => <Ionicons name="download" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="iptv"
          options={{
            title: 'IPTV',
            tabBarIcon: ({ color, size }) => <Ionicons name="tv-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
      </Tabs>

      {/* FAB de sugestão — canto inferior direito, acima da tab bar */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 52 + insets.bottom + 16 }]}
        onPress={() => router.push('/sugestao')}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E50914',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
