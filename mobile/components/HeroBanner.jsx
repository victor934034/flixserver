import { useState, useEffect, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  useWindowDimensions, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HeroBanner({ items = [] }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef(null);
  const timer = useRef(null);

  const list = Array.isArray(items) ? items.slice(0, 5) : [];
  if (list.length === 0) return null;

  const item = list[activeIdx] || list[0];
  const isMovie = !item.total_seasons && !item.year_start;
  const route = isMovie ? `/filme/${item.id}` : `/serie/${item.id}`;
  const name = item.title || item.name || '';
  const bannerH = height * 0.54;

  useEffect(() => {
    if (list.length <= 1) return;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % list.length);
    }, 6000);
    return () => clearInterval(timer.current);
  }, [list.length]);

  return (
    <View style={{ width, height: bannerH }}>
      <Image
        source={{ uri: item.backdrop_url || item.poster_url }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(10,10,10,0.05)', 'rgba(0,0,0,0.5)', '#0a0a0a']}
        locations={[0.2, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { paddingBottom: 32, paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }} />
        <Text style={styles.title} numberOfLines={2}>{name}</Text>
        {item.synopsis ? (
          <Text style={styles.synopsis} numberOfLines={2}>{item.synopsis}</Text>
        ) : null}
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.playBtn} onPress={() => router.push(route)}>
            <Ionicons name="play" size={16} color="#000" />
            <Text style={styles.playText}>Assistir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.infoBtn} onPress={() => router.push(route)}>
            <Ionicons name="information-circle-outline" size={17} color="#fff" />
            <Text style={styles.infoText}>Detalhes</Text>
          </TouchableOpacity>
        </View>
        {list.length > 1 && (
          <View style={styles.dots}>
            {list.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => setActiveIdx(i)}>
                <View style={[styles.dot, i === activeIdx && styles.dotActive]} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 16,
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  synopsis: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 19, marginBottom: 16 },
  buttons: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  playBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 22, borderRadius: 6,
  },
  playText: { color: '#000', fontSize: 15, fontWeight: '700' },
  infoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  infoText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: '#fff', width: 18 },
});
