import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const handleLogout = () =>
    Alert.alert('Sair', 'Deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);

  const initial = user?.name?.[0]?.toUpperCase() || 'U';
  const plan = (user?.plan || 'free').toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name}>{user?.name || 'Usuário'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.planBadge}>
          <Text style={styles.planText}>{plan}</Text>
        </View>
      </View>

      <View style={styles.menu}>
        <MenuItem icon="heart-outline" label="Minha Lista" />
        <MenuItem icon="time-outline" label="Continuar Assistindo" />
        <MenuItem icon="settings-outline" label="Configurações" />
        <MenuItem icon="help-circle-outline" label="Ajuda" />
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#E50914" />
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

function MenuItem({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon} size={22} color="#b3b3b3" />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#333" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: '#E50914', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 34, fontWeight: '700', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  email: { fontSize: 14, color: '#b3b3b3', marginBottom: 12 },
  planBadge: {
    backgroundColor: 'transparent', paddingHorizontal: 20, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#E50914',
  },
  planText: { color: '#E50914', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  menu: { borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#141414',
  },
  menuLabel: { flex: 1, color: '#fff', fontSize: 15, marginLeft: 14 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    margin: 24, paddingVertical: 14, borderWidth: 1, borderColor: '#E50914', borderRadius: 8,
  },
  logoutText: { color: '#E50914', fontSize: 15, fontWeight: '600', marginLeft: 8 },
});
