import { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, TextInput, SectionList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function ChannelsScreen() {
  const router  = useRouter();
  const { data } = useLocalSearchParams();
  const { groups, total, source } = useMemo(() => JSON.parse(data || '{}'), [data]);

  const [search,      setSearch]      = useState('');
  const [activeGroup, setActiveGroup] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = groups || [];
    if (activeGroup) result = result.filter(g => g.group === activeGroup);
    if (q) {
      result = result.map(g => ({
        ...g,
        items: g.items.filter(ch => ch.name.toLowerCase().includes(q)),
      })).filter(g => g.items.length > 0);
    }
    return result;
  }, [groups, search, activeGroup]);

  const sections = filtered.map(g => ({ title: g.group, data: g.items }));
  const groupNames = (groups || []).map(g => g.group);

  function openPlayer(channel) {
    router.push({
      pathname: '/player',
      params: { url: channel.url, name: channel.name, logo: channel.logo || '' },
    });
  }

  return (
    <View style={styles.container}>
      {/* Stats bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>{total} canais · {(groups||[]).length} grupos</Text>
        <Text style={styles.statsSource} numberOfLines={1}>{source}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar canal…"
          placeholderTextColor="#444"
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: '#555', fontSize: 18, paddingHorizontal: 10 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Group filter chips */}
      <FlatList
        horizontal
        data={[null, ...groupNames]}
        keyExtractor={item => item ?? '__all__'}
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, activeGroup === item && styles.chipActive]}
            onPress={() => setActiveGroup(item)}
          >
            <Text style={[styles.chipText, activeGroup === item && styles.chipTextActive]}>
              {item ?? 'Todos'}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Channel list */}
      <SectionList
        sections={sections}
        keyExtractor={(item, i) => item.url + i}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.channelItem} onPress={() => openPlayer(item)} activeOpacity={0.7}>
            {item.logo ? (
              <Image source={{ uri: item.logo }} style={styles.logo} resizeMode="contain" />
            ) : (
              <View style={[styles.logo, styles.logoPlaceholder]}>
                <Text style={{ fontSize: 20 }}>📺</Text>
              </View>
            )}
            <View style={styles.channelInfo}>
              <Text style={styles.channelName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.channelUrl} numberOfLines={1}>{item.url}</Text>
            </View>
            <Text style={styles.playIcon}>▶</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhum canal encontrado</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  statsBar: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  statsText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  statsSource: { color: '#444', fontSize: 11, marginTop: 2 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#141414', margin: 12,
    borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 12 },

  chipRow: { maxHeight: 44, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a' },
  chipActive: { backgroundColor: '#c91c2c', borderColor: '#c91c2c' },
  chipText: { color: '#666', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0d0d0d', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  sectionTitle: { color: '#c91c2c', fontWeight: '700', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { color: '#333', fontSize: 12 },

  channelItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#0f0f0f',
  },
  logo: { width: 48, height: 36, borderRadius: 6, backgroundColor: '#141414', marginRight: 14 },
  logoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  channelInfo: { flex: 1 },
  channelName: { color: '#fff', fontWeight: '600', fontSize: 14 },
  channelUrl: { color: '#333', fontSize: 11, marginTop: 2 },
  playIcon: { color: '#c91c2c', fontSize: 18, marginLeft: 8 },

  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#444', fontSize: 15 },
});
