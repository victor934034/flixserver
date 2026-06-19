import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ImageBackground, TouchableHighlight,
  FlatList, ScrollView, Animated, Dimensions, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const { width: W, height: H } = Dimensions.get('window');
const SIDEBAR_SMALL = 72;
const SIDEBAR_BIG = 224;
const CARD_W = 272;
const CARD_H = 153; // 16:9

const NAV = [
  { icon: 'home', label: 'Início' },
  { icon: 'film-outline', label: 'Filmes' },
  { icon: 'tv-outline', label: 'Séries' },
  { icon: 'heart-outline', label: 'Minha Lista' },
  { icon: 'search', label: 'Buscar' },
];

// ─── Sidebar item ────────────────────────────────────────────────────────────
function NavItem({ icon, label, expanded, onFocus, onBlur, onPress, hasTVPreferredFocus }) {
  const [focused, setFocused] = useState(false);
  return (
    <TouchableHighlight
      hasTVPreferredFocus={hasTVPreferredFocus}
      underlayColor="transparent"
      onFocus={() => { setFocused(true); onFocus?.(); }}
      onBlur={() => { setFocused(false); onBlur?.(); }}
      onPress={onPress}
      style={[styles.navItem, focused && styles.navItemFocused]}
    >
      <View style={styles.navItemInner}>
        <Ionicons name={icon} size={26} color={focused ? '#fff' : '#777'} />
        {expanded ? (
          <Text style={[styles.navLabel, focused && styles.navLabelFocused]}>{label}</Text>
        ) : null}
      </View>
    </TouchableHighlight>
  );
}

// ─── Content card ─────────────────────────────────────────────────────────────
function ContentCard({ item, onPress, onFocus }) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  function handleFocus() {
    setFocused(true);
    Animated.timing(scale, { toValue: 1.1, duration: 140, useNativeDriver: true }).start();
    onFocus?.();
  }
  function handleBlur() {
    setFocused(false);
    Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver: true }).start();
  }

  const img = item.backdrop_url || item.poster_url;

  return (
    <TouchableHighlight
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPress={onPress}
      underlayColor="transparent"
      style={styles.cardTouch}
    >
      <Animated.View style={[styles.card, focused && styles.cardFocused, { transform: [{ scale }] }]}>
        {img
          ? <Image source={{ uri: img }} style={styles.cardImg} />
          : <View style={[styles.cardImg, styles.cardImgPlaceholder]} />
        }
        {focused && (
          <View style={styles.cardPlayOverlay}>
            <Ionicons name="play-circle" size={40} color="#fff" />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.cardGrad}
        />
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title || item.name}</Text>
      </Animated.View>
    </TouchableHighlight>
  );
}

// ─── Content row ──────────────────────────────────────────────────────────────
function ContentRow({ title, data, onSelect, onFocus }) {
  const listRef = useRef(null);

  function handleCardFocus(idx) {
    onFocus?.();
    listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
  }

  if (!data?.length) return null;

  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{title}</Text>
      <FlatList
        ref={listRef}
        data={data}
        horizontal
        keyExtractor={it => String(it.id)}
        showsHorizontalScrollIndicator={false}
        removeClippedSubviews={false}
        getItemLayout={(_, i) => ({ length: CARD_W + 12, offset: (CARD_W + 12) * i, index: i })}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item, index }) => (
          <ContentCard
            item={item}
            onPress={() => onSelect(item)}
            onFocus={() => handleCardFocus(index)}
          />
        )}
      />
    </View>
  );
}

// ─── Home screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { logout } = useAuth();
  const [featured, setFeatured] = useState(null);
  const [sections, setSections] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarW = useRef(new Animated.Value(SIDEBAR_SMALL)).current;
  const blurTimer = useRef(null);

  useEffect(() => {
    Animated.timing(sidebarW, {
      toValue: sidebarOpen ? SIDEBAR_BIG : SIDEBAR_SMALL,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [sidebarOpen]);

  const onSidebarFocus = useCallback(() => {
    clearTimeout(blurTimer.current);
    setSidebarOpen(true);
  }, []);

  const onSidebarBlur = useCallback(() => {
    blurTimer.current = setTimeout(() => setSidebarOpen(false), 120);
  }, []);

  const onContentFocus = useCallback(() => {
    clearTimeout(blurTimer.current);
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    loadData();
    return () => clearTimeout(blurTimer.current);
  }, []);

  async function loadData() {
    try {
      const [feat, nm, ns, pm, ps] = await Promise.all([
        api.get('/featured').catch(() => ({ data: [] })),
        api.get('/movies/section/new').catch(() => ({ data: [] })),
        api.get('/series/section/new').catch(() => ({ data: [] })),
        api.get('/movies/section/popular').catch(() => ({ data: [] })),
        api.get('/series/section/popular').catch(() => ({ data: [] })),
      ]);
      const featList = Array.isArray(feat.data) ? feat.data : [];
      setFeatured(featList[0] || null);
      setSections([
        { title: 'Lançamentos — Filmes', data: Array.isArray(nm.data) ? nm.data : [], type: 'movie' },
        { title: 'Lançamentos — Séries', data: Array.isArray(ns.data) ? ns.data : [], type: 'series' },
        { title: 'Populares — Filmes', data: Array.isArray(pm.data) ? pm.data : [], type: 'movie' },
        { title: 'Populares — Séries', data: Array.isArray(ps.data) ? ps.data : [], type: 'series' },
      ]);
    } catch {}
  }

  function openDetail(item, type) {
    navigation.navigate('Detail', { item, type });
  }

  function playFeatured() {
    if (!featured) return;
    const url = featured.file_dubbing || featured.file_subtitled || featured.file_cinema || featured.file_4k;
    if (url) {
      navigation.navigate('Player', { url, title: featured.title, poster: featured.backdrop_url });
    }
  }

  const isSeries = item => item?.total_seasons !== undefined;

  return (
    <View style={styles.container}>
      {/* Backdrop */}
      {featured?.backdrop_url
        ? <Image source={{ uri: featured.backdrop_url }} style={styles.backdrop} blurRadius={2} />
        : <View style={[styles.backdrop, { backgroundColor: '#111' }]} />
      }

      {/* Gradients */}
      <LinearGradient
        colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)', '#000']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.82)', 'rgba(0,0,0,0)']}
        style={[StyleSheet.absoluteFill, { width: W * 0.55 }]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      />

      <View style={styles.layout}>
        {/* ── Sidebar ── */}
        <Animated.View style={[styles.sidebar, { width: sidebarW }]}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>F</Text>
          </View>

          {NAV.map((item, idx) => (
            <NavItem
              key={idx}
              icon={item.icon}
              label={item.label}
              expanded={sidebarOpen}
              onFocus={onSidebarFocus}
              onBlur={onSidebarBlur}
              onPress={() => {}}
            />
          ))}

          <View style={{ flex: 1 }} />

          <NavItem
            icon="log-out-outline"
            label="Sair"
            expanded={sidebarOpen}
            onFocus={onSidebarFocus}
            onBlur={onSidebarBlur}
            onPress={logout}
          />
        </Animated.View>

        {/* ── Content ── */}
        <View style={styles.content}>
          {/* Hero */}
          <View style={styles.hero}>
            {featured && (
              <>
                <View style={styles.heroBadges}>
                  {featured.age_rating && (
                    <View style={styles.ageBadge}>
                      <Text style={styles.ageBadgeText}>{featured.age_rating}+</Text>
                    </View>
                  )}
                  {featured.year && <Text style={styles.heroMeta}>{featured.year}</Text>}
                  {featured.rating > 0 && (
                    <Text style={styles.heroMeta}>★ {Number(featured.rating).toFixed(1)}</Text>
                  )}
                </View>

                <Text style={styles.heroTitle} numberOfLines={2}>{featured.title}</Text>

                <Text style={styles.heroSynopsis} numberOfLines={3}>
                  {featured.synopsis}
                </Text>

                <View style={styles.heroActions}>
                  <TouchableHighlight
                    hasTVPreferredFocus
                    onPress={playFeatured}
                    onFocus={onContentFocus}
                    underlayColor="rgba(255,255,255,0.2)"
                    style={styles.btnPlay}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="play" size={22} color="#000" />
                      <Text style={styles.btnPlayText}>Assistir</Text>
                    </View>
                  </TouchableHighlight>

                  <TouchableHighlight
                    onPress={() => openDetail(featured, isSeries(featured) ? 'series' : 'movie')}
                    onFocus={onContentFocus}
                    underlayColor="rgba(255,255,255,0.15)"
                    style={styles.btnInfo}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="information-circle-outline" size={22} color="#fff" />
                      <Text style={styles.btnInfoText}>Mais Info</Text>
                    </View>
                  </TouchableHighlight>
                </View>
              </>
            )}
          </View>

          {/* Rows */}
          <ScrollView
            style={styles.rows}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
          >
            {sections.map((sec, idx) => (
              <ContentRow
                key={idx}
                title={sec.title}
                data={sec.data}
                onSelect={item => openDetail(item, sec.type)}
                onFocus={onContentFocus}
              />
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    width: W,
    height: H,
    resizeMode: 'cover',
  },
  layout: { flex: 1, flexDirection: 'row' },

  // Sidebar
  sidebar: {
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    paddingBottom: 20,
  },
  logoBox: {
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoText: { fontSize: 28, fontWeight: '900', color: '#E50914' },
  navItem: {
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 8,
    marginHorizontal: 6,
    marginVertical: 2,
  },
  navItemFocused: { backgroundColor: 'rgba(255,255,255,0.13)' },
  navItemInner: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  navLabel: { fontSize: 18, color: '#888', fontWeight: '500' },
  navLabelFocused: { color: '#fff' },

  // Content
  content: { flex: 1 },

  // Hero
  hero: {
    height: H * 0.54,
    justifyContent: 'flex-end',
    paddingHorizontal: 56,
    paddingBottom: 28,
  },
  heroBadges: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  ageBadge: {
    backgroundColor: '#E50914',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  ageBadgeText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  heroMeta: { color: '#bbb', fontSize: 16 },
  heroTitle: {
    fontSize: 54,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 12,
    maxWidth: W * 0.48,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  heroSynopsis: {
    fontSize: 18,
    color: '#ddd',
    lineHeight: 27,
    maxWidth: W * 0.44,
    marginBottom: 28,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroActions: { flexDirection: 'row', gap: 16 },
  btnPlay: {
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 6,
  },
  btnPlayText: { fontSize: 18, fontWeight: '700', color: '#000' },
  btnInfo: {
    backgroundColor: 'rgba(109,109,110,0.7)',
    borderWidth: 0,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 6,
  },
  btnInfoText: { fontSize: 18, fontWeight: '600', color: '#fff' },

  // Rows
  rows: { flex: 1 },
  row: { marginBottom: 28, paddingLeft: 56 },
  rowTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e5e5e5',
    marginBottom: 14,
    letterSpacing: 0.3,
  },

  // Card
  cardTouch: { marginRight: 10 },
  card: {
    width: CARD_W,
    height: CARD_H + 32,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  cardFocused: {
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 6,
  },
  cardImg: { width: CARD_W, height: CARD_H, resizeMode: 'cover' },
  cardImgPlaceholder: { backgroundColor: '#222' },
  cardPlayOverlay: {
    position: 'absolute',
    top: 0, left: 0, width: CARD_W, height: CARD_H,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cardGrad: {
    position: 'absolute',
    bottom: 32, left: 0, right: 0,
    height: 48,
  },
  cardTitle: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
});
