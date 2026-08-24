import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

export default function NotificacoesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const prefs = user?.notification_prefs || { new_content: true, billing: true };
  const [newContent, setNewContent] = useState(prefs.new_content !== false);
  const [billing, setBilling] = useState(prefs.billing !== false);
  const [saving, setSaving] = useState(false);

  async function toggle(key, value, setter) {
    setter(value);
    setSaving(true);
    try {
      await api.put('/auth/notification-prefs', { [key]: value });
      await refreshUser();
    } catch {
      setter(!value); // reverte se falhar
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Notificações</Text>
      </View>

      <Text style={styles.hint}>
        Escolha quais avisos push você quer receber neste dispositivo. Para desativar
        notificações completamente, use as configurações do sistema Android/iOS.
      </Text>

      <View style={styles.section}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Novo conteúdo</Text>
            <Text style={styles.rowDesc}>Avisos quando um filme, série ou episódio novo for adicionado</Text>
          </View>
          <Switch
            value={newContent}
            onValueChange={v => toggle('new_content', v, setNewContent)}
            trackColor={{ false: '#2a2a2a', true: '#E50914' }}
            thumbColor="#fff"
            disabled={saving}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Assinatura e IPTV</Text>
            <Text style={styles.rowDesc}>Avisos de ativação e de vencimento próximo da sua assinatura</Text>
          </View>
          <Switch
            value={billing}
            onValueChange={v => toggle('billing', v, setBilling)}
            trackColor={{ false: '#2a2a2a', true: '#E50914' }}
            thumbColor="#fff"
            disabled={saving}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: { padding: 6, marginRight: 4 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  hint: { color: '#666', fontSize: 12.5, lineHeight: 18, paddingHorizontal: 20, marginBottom: 20 },
  section: { paddingHorizontal: 20, marginBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#141414', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1e1e1e' },
  rowLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  rowDesc: { color: '#777', fontSize: 12, marginTop: 4, lineHeight: 17 },
});
