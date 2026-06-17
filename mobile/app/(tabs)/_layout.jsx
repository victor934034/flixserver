import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#1f1f1f',
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#E50914',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
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
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
