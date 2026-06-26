import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { xcGetCategories } from '../utils/xcApi';

// status: 'loading' | 'active' | 'pending' | 'none'
export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [status,     setStatus]     = useState('loading');
  const [creds,      setCreds]      = useState(null);
  const [pendingInfo, setPendingInfo] = useState(null);
  const [categories, setCategories] = useState([]);
  const [search,     setSearch]     = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await api.get('/iptv/status');

      if (data.status === 'active') {
        setCreds(data);
        const cats = await xcGetCategories(data.server_url, data.xc_username, data.xc_password);
        setCategories(Array.isArray(cats) ? cats : []);
        setStatus('active');
      } else if (data.status === 'pending') {
        setPendingInfo(data);
        setStatus('pending');
      } else {
        setStatus('none');
      }
    } catch {
      setStatus('none');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── LOADING ──
  if (status === 'loading') return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#c91c2c" />
      <Text style={styles.loadingText}>Verificando assinatura…</Text>
    </View>
  );

  // ── SEM ASSINATURA → vai para tela de planos ──
  if (status === 'none') return (
    <View style={styles.center}>
      <Text style={styles.icon}>📺</Text>
      <Text style={styles.noSubTitle}>FlixHome IPTV</Text>
      <Text style={styles.noSubText}>Você ainda não tem uma assinatura IPTV ativa.</Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/plans')}>
        <Text style={styles.primaryBtnText}>Ver planos disponíveis</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );

  // ── PENDENTE ──
  if (status === 'pending') return (
    <View style={styles.center}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.pendingTitle}>Pagamento confirmado!</Text>
      <Text style={styles.pendingPlan}>{pendingInfo?.plan_name}</Text>
      <Text style={styles.pendingText}>
        Sua assinatura está sendo ativada pelo administrador.{'\n'}
        Prazo: até 24 horas após o pagamento.
      </Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={load}>
        <Text style={styles.primaryBtnText}>Verificar novamente</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );

  // ── ATIVO → lista de categorias ──
  const filtered = search.trim()
    ? categories.filter(c => c.category_name?.toLowerCase().includes(search.toLowerCase()))
    : categories;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>📺 IPTV</Text>
          <Text style={styles.greeting}>Olá, {user?.name?.split(' ')[0] ?? 'usuário'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Buscar categoria..."
        placeholderTextColor="#444"
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.category_id)}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor="#c91c2c" colors={['#c91c2c']} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.catRow}
            activeOpacity={0.7}
            onPress={() => router.push({
              pathname: '/channels',
              params: {
                category_id:  item.category_id,
                category_name: item.category_name,
                server_url:   creds.server_url,
                xc_username:  creds.xc_username,
                xc_password:  creds.xc_password,
              },
            })}
          >
            <Text style={styles.catName}>{item.category_name}</Text>
            <Text style={styles.catArrow}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhuma categoria encontrada</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  center: {
    flex: 1, backgroundColor: '#0a0a0a',
    alignItems: 'center', justifyContent: 'center',
    gap: 14, padding: 32,
  },
  loadingText: { color: '#555', fontSize: 14 },
  icon: { fontSize: 60, marginBottom: 4 },

  noSubTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  noSubText:  { color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  pendingTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  pendingPlan:  { color: '#c91c2c', fontWeight: '700', fontSize: 15 },
  pendingText:  { color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  primaryBtn: {
    backgroundColor: '#c91c2c', paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 10, marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  logoutBtn: {
    backgroundColor: '#1a1a1a', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a',
  },
  logoutText: { color: '#888', fontSize: 13 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 20,
    borderBottomWidth: 1, borderBottomColor: '#141414',
  },
  title:    { color: '#fff', fontSize: 22, fontWeight: '800' },
  greeting: { color: '#555', fontSize: 13, marginTop: 2 },

  search: {
    backgroundColor: '#141414', color: '#fff', padding: 12,
    margin: 12, borderRadius: 10, borderWidth: 1, borderColor: '#222',
    fontSize: 14,
  },
  catRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: '#111',
  },
  catName:  { flex: 1, color: '#fff', fontSize: 15 },
  catArrow: { color: '#333', fontSize: 22 },
  empty:    { color: '#333', textAlign: 'center', fontSize: 14, marginTop: 40 },
});
