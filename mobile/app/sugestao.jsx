import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  Image, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../lib/api';

export default function SugestaoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const searchTimer = useRef(null);

  function onQueryChange(text) {
    setQuery(text);
    if (selected) setSelected(null);
    clearTimeout(searchTimer.current);
    if (text.trim().length < 2) { setResults([]); return; }
    searchTimer.current = setTimeout(() => doSearch(text.trim()), 500);
  }

  async function doSearch(q) {
    setSearching(true);
    try {
      const { data } = await api.get('/search', { params: { q, limit: 8 } });
      const items = [
        ...(data.movies || []).map(m => ({ ...m, type: 'movie', displayYear: m.year })),
        ...(data.series || []).map(s => ({ ...s, type: 'series', displayYear: s.year_start })),
      ];
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function selectItem(item) {
    setSelected(item);
    setQuery(item.title);
    setResults([]);
  }

  async function submit() {
    const title = selected?.title || query.trim();
    if (!title) { Alert.alert('Atenção', 'Informe o título do filme ou série.'); return; }

    setSubmitting(true);
    try {
      await api.post('/suggestions', {
        title,
        original_title: selected?.original_title || null,
        year: selected?.displayYear || null,
        type: selected?.type || 'movie',
        poster_url: selected?.poster_url || null,
        tmdb_id: selected?.id || null,
        message: message.trim() || null,
      });
      Alert.alert('Obrigado!', 'Sua sugestão foi enviada. Vamos analisar em breve!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Não foi possível enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0a0a0a' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sugerir Conteúdo</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.subtitle}>
          Quer ver algo específico? Sugira um filme ou série e vamos tentar adicionar!
        </Text>

        {/* Search / title input */}
        <Text style={styles.label}>Buscar no catálogo TMDB</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#555" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={onQueryChange}
            placeholder="Digite o nome do filme ou série..."
            placeholderTextColor="#555"
            returnKeyType="search"
            onSubmitEditing={() => query.trim().length >= 2 && doSearch(query.trim())}
          />
          {searching && <ActivityIndicator size="small" color="#E50914" />}
          {query.length > 0 && !searching && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSelected(null); }}>
              <Ionicons name="close-circle" size={18} color="#444" />
            </TouchableOpacity>
          )}
        </View>

        {/* TMDB results */}
        {results.length > 0 && (
          <View style={styles.resultList}>
            {results.map(item => (
              <TouchableOpacity key={`${item.type}-${item.id}`} style={styles.resultItem} onPress={() => selectItem(item)}>
                {item.poster_url ? (
                  <Image source={{ uri: item.poster_url }} style={styles.resultPoster} />
                ) : (
                  <View style={[styles.resultPoster, styles.resultPosterFallback]}>
                    <Ionicons name={item.type === 'series' ? 'tv' : 'film'} size={18} color="#444" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.resultMeta}>
                    {item.displayYear ? `${item.displayYear} · ` : ''}
                    {item.type === 'series' ? 'Série' : 'Filme'}
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={22} color="#E50914" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Selected preview */}
        {selected && (
          <View style={styles.selectedCard}>
            {selected.poster_url && (
              <Image source={{ uri: selected.poster_url }} style={styles.selectedPoster} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedTitle}>{selected.title}</Text>
              <Text style={styles.selectedMeta}>
                {selected.displayYear ? `${selected.displayYear} · ` : ''}
                {selected.type === 'series' ? 'Série' : 'Filme'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setSelected(null); setQuery(''); }}>
              <Ionicons name="close-circle" size={20} color="#555" />
            </TouchableOpacity>
          </View>
        )}

        {/* Optional message */}
        <Text style={[styles.label, { marginTop: 20 }]}>Mensagem (opcional)</Text>
        <TextInput
          style={styles.messageInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Alguma observação? Ex: prefiro dublado, temporada 2..."
          placeholderTextColor="#444"
          multiline
          maxLength={300}
        />
        <Text style={styles.charCount}>{message.length}/300</Text>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>Enviar sugestão</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  subtitle: { color: '#888', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  label: { color: '#aaa', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 2,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  resultList: {
    backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#222',
    marginBottom: 12, overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  resultPoster: { width: 38, height: 54, borderRadius: 4 },
  resultPosterFallback: { backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  resultTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  resultMeta: { color: '#666', fontSize: 12, marginTop: 2 },
  selectedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1a2a1a', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#2a4a2a', marginBottom: 8,
  },
  selectedPoster: { width: 38, height: 54, borderRadius: 4 },
  selectedTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  selectedMeta: { color: '#66aa66', fontSize: 12, marginTop: 2 },
  messageInput: {
    backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14, paddingTop: 14,
    color: '#fff', fontSize: 14, minHeight: 90, textAlignVertical: 'top',
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  charCount: { color: '#444', fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 24 },
  submitBtn: {
    backgroundColor: '#E50914', borderRadius: 10, paddingVertical: 16, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
