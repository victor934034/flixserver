import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useDownloads, fmtBytes } from '../../contexts/DownloadContext';
import { useParental } from '../../contexts/ParentalContext';

export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const router = useRouter();
  const { downloads, active, totalBytes } = useDownloads();
  const { config: parentalConfig } = useParental();

  const activeCount = Object.keys(active).length;
  const dlCount = downloads.length + activeCount;

  const handleLogout = () =>
    Alert.alert('Sair', 'Deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);

  const initial = user?.name?.[0]?.toUpperCase() || 'U';
  const plan = (user?.plan || 'free').toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name}>{user?.name || 'Usuário'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.planBadge}>
          <Text style={styles.planText}>{plan}</Text>
        </View>
      </View>

      {user?.is_admin && (
        <View style={[styles.section, { marginTop: 4 }]}>
          <Text style={styles.sectionLabel}>Administrador</Text>
          <View style={styles.card}>
            <MenuItem
              icon="cloud-upload-outline"
              label="Upload de Vídeo"
              desc="Enviar filme ou série para o servidor"
              onPress={() => router.push('/admin-upload')}
            />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Minha Conta</Text>
        <View style={styles.card}>
          <MenuItem
            icon="heart-outline"
            label="Minha Lista"
            desc="Conteúdos salvos"
            onPress={() => router.push('/minha-lista')}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="time-outline"
            label="Histórico"
            desc="Continue de onde parou"
            onPress={() => router.push('/historico')}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="download-outline"
            label="Downloads"
            desc={dlCount > 0 ? `${dlCount} arquivo${dlCount !== 1 ? 's' : ''} · ${fmtBytes(totalBytes)}` : 'Filmes e episódios offline'}
            onPress={() => router.push('/(tabs)/downloads')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Preferências</Text>
        <View style={styles.card}>
          <MenuItem
            icon="notifications-outline"
            label="Notificações"
            onPress={() => Alert.alert('Notificações', 'Ative ou desative notificações nas configurações do sistema.')}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="shield-checkmark-outline"
            label="Controle Parental"
            desc={parentalConfig.enabled ? `Ativo · máx ${parentalConfig.maxRating}+` : 'Desativado'}
            onPress={() => router.push('/parental-controls')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Suporte</Text>
        <View style={styles.card}>
          <MenuItem
            icon="help-circle-outline"
            label="Ajuda"
            onPress={() => Alert.alert('Flixhome', 'Versão 1.0.0\n\nPara suporte entre em contato pelo painel admin.')}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="information-circle-outline"
            label="Sobre o App"
            onPress={() => Alert.alert('Sobre', 'Flixhome v1.0.0\nSua plataforma de streaming.')}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#E50914" />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>

      <Text style={styles.version}>v1.0.0</Text>
    </ScrollView>
  );
}

function MenuItem({ icon, label, desc, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, disabled && styles.menuItemDisabled]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.6}
    >
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={20} color={disabled ? '#333' : '#b3b3b3'} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, disabled && { color: '#444' }]}>{label}</Text>
        {desc && <Text style={styles.menuDesc}>{desc}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={disabled ? '#222' : '#333'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { alignItems: 'center', paddingBottom: 28, paddingHorizontal: 24 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#E50914', justifyContent: 'center', alignItems: 'center',
    marginBottom: 14, shadowColor: '#E50914', shadowOpacity: 0.4,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  email: { fontSize: 13, color: '#666', marginBottom: 14 },
  planBadge: {
    paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#E50914',
  },
  planText: { color: '#E50914', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionLabel: {
    color: '#555', fontSize: 11, fontWeight: '600', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 10, paddingLeft: 4,
  },
  card: { backgroundColor: '#111', borderRadius: 14, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: '#1a1a1a', marginLeft: 58 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 15, paddingHorizontal: 16,
  },
  menuItemDisabled: { opacity: 0.5 },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center',
    marginRight: 14,
  },
  menuText: { flex: 1 },
  menuLabel: { color: '#fff', fontSize: 15 },
  menuDesc: { color: '#555', fontSize: 12, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 16, marginTop: 8, marginBottom: 16,
    paddingVertical: 15, borderWidth: 1, borderColor: '#E50914',
    borderRadius: 14, gap: 8,
  },
  logoutText: { color: '#E50914', fontSize: 15, fontWeight: '600' },
  version: { color: '#333', fontSize: 12, textAlign: 'center', marginBottom: 8 },
});
