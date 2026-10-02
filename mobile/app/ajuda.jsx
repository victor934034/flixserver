import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../lib/api';

function FaqItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity style={styles.faqItem} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{item.question}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
      </View>
      {open && <Text style={styles.faqAnswer}>{item.answer}</Text>}
    </TouchableOpacity>
  );
}

export default function AjudaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/help').then(r => setArticles(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajuda</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator color="#E50914" style={{ marginTop: 40 }} />
        ) : articles.length === 0 ? (
          <Text style={styles.empty}>Nenhuma pergunta cadastrada ainda.</Text>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Perguntas frequentes</Text>
            {articles.map(a => <FaqItem key={a.id} item={a} />)}
          </>
        )}

        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Não achou o que precisava?</Text>
        <TouchableOpacity
          style={styles.contactBtn}
          onPress={() => Linking.openURL('mailto:victorlima0978@gmail.com?subject=Suporte%20FlixHome')}
        >
          <Ionicons name="mail-outline" size={20} color="#fff" />
          <Text style={styles.contactText}>Falar por e-mail</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.contactBtn}
          onPress={() => router.push('/sugestao')}
        >
          <Ionicons name="bulb-outline" size={20} color="#fff" />
          <Text style={styles.contactText}>Sugerir um filme ou série</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  sectionLabel: { color: '#666', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },
  empty: { color: '#555', fontSize: 14, textAlign: 'center', marginTop: 40 },

  faqItem: {
    backgroundColor: '#141414', borderRadius: 10, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#222',
  },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  faqQuestion: { color: '#fff', fontSize: 14.5, fontWeight: '600', flex: 1 },
  faqAnswer: { color: '#999', fontSize: 13.5, lineHeight: 20, marginTop: 10 },

  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1a1a1a', borderRadius: 10, padding: 15, marginBottom: 10,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  contactText: { color: '#fff', fontSize: 14.5, fontWeight: '600' },
});
