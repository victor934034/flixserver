import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../lib/api';

export default function CronologiaDetailScreen() {
  const { slug } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [collection, setCollection] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get(`/collections/${slug}`)
      .then(r => setCollection(r.data))
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header router={router} title="Cronologia" />
        <View style={styles.loader}><Text style={styles.emptyText}>Cronologia não encontrada</Text></View>
      </View>
    );
  }

  if (!collection) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header router={router} title="Cronologia" />
        <View style={styles.loader}><ActivityIndicator size="large" color="#E50914" /></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={collection.items}
        keyExtractor={item => `${item.type}-${item.id}`}
        ListHeaderComponent={
          <View>
            {collection.cover_url ? (
              <Image source={{ uri: collection.cover_url }} style={styles.hero} resizeMode="cover" />
            ) : (
              <View style={[styles.hero, styles.heroPlaceholder]} />
            )}
            <LinearGradient
              colors={['transparent', 'rgba(10,10,10,0.85)', '#0a0a0a']}
              locations={[0, 0.6, 1]}
              style={styles.heroGradient}
            />
            <View style={[styles.headerOverlay, { paddingTop: insets.top }]}>
              <Header router={router} transparent />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.kicker}>CRONOLOGIA</Text>
              <Text style={styles.collectionTitle}>{collection.name}</Text>
              {collection.description ? <Text style={styles.desc}>{collection.description}</Text> : null}
              {collection.items?.length > 0 && (
                <Text style={styles.count}>{collection.items.length} título{collection.items.length !== 1 ? 's' : ''} em ordem</Text>
              )}
            </View>
          </View>
        }
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const isLast = index === collection.items.length - 1;
          const year = item.year || item.year_start;
          return (
            <View style={styles.row}>
              <View style={styles.markerCol}>
                <View style={styles.marker}><Text style={styles.markerText}>{index + 1}</Text></View>
                {!isLast && <View style={styles.connector} />}
              </View>
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => router.push(item.type === 'series' ? `/serie/${item.id}` : `/filme/${item.id}`)}
              >
                {item.poster_url ? (
                  <Image source={{ uri: item.poster_url }} style={styles.poster} resizeMode="cover" />
                ) : (
                  <View style={[styles.poster, styles.posterPlaceholder]} />
                )}
                <View style={styles.cardInfo}>
                  <View style={styles.infoTop}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{item.type === 'series' ? 'SÉRIE' : 'FILME'}</Text>
                    </View>
                    {year ? <Text style={styles.year}>{year}</Text> : null}
                    {item.rating > 0 ? <Text style={styles.rating}>★ {Number(item.rating).toFixed(1)}</Text> : null}
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  {item.note ? <Text style={styles.note} numberOfLines={1}>{item.note}</Text> : null}
                  {item.synopsis ? <Text style={styles.synopsis} numberOfLines={3}>{item.synopsis}</Text> : null}
                </View>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

function Header({ router, title, transparent }) {
  return (
    <View style={styles.headerRow}>
      <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, transparent && styles.backBtnTransparent]}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>
      {title ? <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10 },
  backBtn: { padding: 6, marginRight: 4 },
  backBtnTransparent: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#555', fontSize: 14 },

  hero: { width: '100%', height: 220, backgroundColor: '#141414' },
  heroPlaceholder: { backgroundColor: '#141414' },
  heroGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 220 },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroInfo: {
    marginTop: -60, paddingHorizontal: 16, paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  kicker: { color: '#E50914', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  collectionTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  desc: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 6, lineHeight: 19 },
  count: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', marginTop: 8 },

  list: { paddingBottom: 32 },
  row: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 18 },
  markerCol: { alignItems: 'center', width: 32, marginRight: 12 },
  marker: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#141414',
    borderWidth: 2, borderColor: '#E50914', justifyContent: 'center', alignItems: 'center',
  },
  markerText: { color: '#E50914', fontWeight: '800', fontSize: 12.5 },
  connector: { flex: 1, width: 2, minHeight: 20, backgroundColor: '#2a2a2a', marginTop: 4 },

  card: { flex: 1, flexDirection: 'row', gap: 12 },
  poster: { width: 74, height: 108, borderRadius: 6, backgroundColor: '#1a1a1a' },
  posterPlaceholder: { backgroundColor: '#1a1a1a' },
  cardInfo: { flex: 1, minWidth: 0 },
  infoTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  typeBadge: { backgroundColor: '#E50914', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  year: { color: '#888', fontSize: 11.5 },
  rating: { color: '#f5c518', fontSize: 11.5, fontWeight: '700' },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 19 },
  note: { color: '#E50914', fontSize: 11.5, fontWeight: '600', marginTop: 3 },
  synopsis: { color: '#888', fontSize: 12, lineHeight: 17, marginTop: 4 },
});
