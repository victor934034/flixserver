import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  FlatList, ScrollView, Animated, Dimensions, Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

// ─── Screen scale ─────────────────────────────────────────────────────────────
const { width: W, height: H } = Dimensions.get('window');
const S = Math.min(W / 1920, H / 1080);
const r = v => Math.max(1, Math.round(v * S));

const SIDEBAR_SM = r(72);
const SIDEBAR_LG = r(240);
const CARD_W     = r(248);
const CARD_H     = Math.round(CARD_W * 9 / 16);
const CARD_GAP   = r(16);
const ICON_SZ    = r(24);

const NAV = [
  { icon: 'home',          label: 'Início',      idx: 0 },
  { icon: 'film-outline',  label: 'Filmes',      idx: 1 },
  { icon: 'tv-outline',    label: 'Séries',      idx: 2 },
  { icon: 'heart-outline', label: 'Minha Lista', idx: 3 },
  { icon: 'search',        label: 'Buscar',      idx: 4 },
];

// ─── TVPressable ──────────────────────────────────────────────────────────────
function TVPressable({ children, style, onPress, onFocus, onBlur, hasTVPreferredFocus, focusable = true }) {
  return (
    <Pressable
      focusable={focusable}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={onFocus}
      onBlur={onBlur}
      onPress={onPress}
      style={style}
    >
      {children}
    </Pressable>
  );
}

// ─── NavItem ──────────────────────────────────────────────────────────────────
function NavItem({ icon, label, labelOp, active, danger, onFocus, onBlur, onPress, hasTVPreferredFocus, focusable = true }) {
  const [foc, setFoc] = useState(false);
  return (
    <TVPressable
      focusable={focusable}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => { setFoc(true); onFocus?.(); }}
      onBlur={() => { setFoc(false); onBlur?.(); }}
      onPress={onPress}
      style={s.navItem}
    >
      <View style={[
        s.navPill,
        foc && (danger ? s.navPillDanger : s.navPillFoc),
        active && !foc && s.navPillActive,
      ]}>
        <View style={s.navIconWrap}>
          <Ionicons
            name={icon}
            size={ICON_SZ}
            color={foc ? '#fff' : active ? '#fff' : danger ? '#E50914' : '#888'}
          />
          {active && !foc && <View style={s.navActiveDot} />}
        </View>
        <Animated.Text
          style={[s.navLabel, (foc || active) && s.navLabelFoc, { opacity: labelOp }]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
      </View>
    </TVPressable>
  );
}

// ─── ContentCard ──────────────────────────────────────────────────────────────
function ContentCard({ item, onPress, onFocus: notifyRow }) {
  const [foc, setFoc] = useState(false);

  const img   = item.backdrop_url || item.poster_url;
  const title = item.title || item.name || '';

  return (
    <TVPressable
      onFocus={() => { setFoc(true); notifyRow?.(); }}
      onBlur={() => setFoc(false)}
      onPress={onPress}
      style={{ marginRight: CARD_GAP }}
    >
      <View style={[s.cardFrame, foc && s.cardFrameFoc]}>
        <View style={s.cardImgWrap}>
          {img
            ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1f1f1f' }]} />
          }
          {foc && (
            <View style={s.cardOverlay}>
              <Ionicons name="play-circle" size={r(46)} color="rgba(255,255,255,0.95)" />
            </View>
          )}
        </View>
      </View>
      <Text style={[s.cardTitle, foc && s.cardTitleFoc]} numberOfLines={1}>{title}</Text>
    </TVPressable>
  );
}

// ─── ContentRow ───────────────────────────────────────────────────────────────
function ContentRow({ title, data, onSelect, onFocus }) {
  const listRef = useRef(null);

  if (!data?.length) return null;

  return (
    <View style={s.row}>
      <Text style={s.rowTitle}>{title}</Text>
      <View style={s.rowListWrap}>
        <FlatList
          ref={listRef}
          data={data}
          horizontal
          keyExtractor={it => String(it.id)}
          showsHorizontalScrollIndicator={false}
          removeClippedSubviews={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={{ paddingRight: r(40) }}
          getItemLayout={(_, i) => ({ length: CARD_W + CARD_GAP, offset: (CARD_W + CARD_GAP) * i, index: i })}
          onScrollToIndexFailed={() => {}}
          renderItem={({ item, index }) => (
            <ContentCard
              item={item}
              onPress={() => onSelect(item)}
              onFocus={() => {
                onFocus?.();
                try { listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.15 }); } catch {}
              }}
            />
          )}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.rowFade}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

// ─── HeroBtn ──────────────────────────────────────────────────────────────────
function HeroBtn({ icon, label, primary, onPress, onFocus, hasTVPreferredFocus }) {
  const [foc, setFoc] = useState(false);
  return (
    <TVPressable
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      onFocus={() => { setFoc(true); onFocus?.(); }}
      onBlur={() => setFoc(false)}
      style={[s.heroBtn, primary ? s.heroBtnPri : s.heroBtnSec, foc && s.heroBtnFoc]}
    >
      <View style={s.heroBtnRow}>
        <Ionicons name={icon} size={r(20)} color={primary && !foc ? '#000' : '#fff'} />
        <Text style={[s.heroBtnTxt, primary && !foc && { color: '#000' }]}>{label}</Text>
      </View>
    </TVPressable>
  );
}

// ─── Keyboard key ─────────────────────────────────────────────────────────────
function KeyBtn({ label, onPress, wide, hasTVPreferredFocus }) {
  const [foc, setFoc] = useState(false);
  const isSpc = label === 'SPC';
  const isDel = label === '⌫';
  return (
    <TVPressable
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      onFocus={() => setFoc(true)}
      onBlur={() => setFoc(false)}
      style={[s.kbKey, foc && s.kbKeyFoc, isSpc && s.kbKeySpc, isDel && s.kbKeyDel]}
    >
      <Text style={[s.kbKeyTxt, foc && s.kbKeyTxtFoc]}>
        {isSpc ? 'ESPAÇO' : label}
      </Text>
    </TVPressable>
  );
}

// ─── Suggestion row ───────────────────────────────────────────────────────────
function SugItem({ item, onPress }) {
  const [foc, setFoc] = useState(false);
  const isS = item.total_seasons !== undefined;
  return (
    <TVPressable
      onPress={onPress}
      onFocus={() => setFoc(true)}
      onBlur={() => setFoc(false)}
      style={[s.sugItem, foc && s.sugItemFoc]}
    >
      <Ionicons name={isS ? 'tv-outline' : 'film-outline'} size={r(15)} color={foc ? '#E50914' : '#484848'} />
      <Text style={[s.sugTxt, foc && s.sugTxtFoc]} numberOfLines={1}>
        {item.title || item.name}
      </Text>
      <Ionicons name="chevron-forward" size={r(13)} color={foc ? '#666' : '#2a2a2a'} />
    </TVPressable>
  );
}

const KB_ROWS = [
  ['SPC','⌫'],
  ['a','b','c','d','e','f'],
  ['g','h','i','j','k','l'],
  ['m','n','o','p','q','r'],
  ['s','t','u','v','w','x'],
  ['y','z','1','2','3','4'],
  ['5','6','7','8','9','0'],
];

const LEFT_W   = r(370);
const GRID_COLS = 3;
const GRID_GAP  = r(10);

// ─── Grid card (search results) ───────────────────────────────────────────────
function GridCard({ item, onPress, onFocus: notifyRow }) {
  const [foc, setFoc] = useState(false);
  const img   = item.backdrop_url || item.poster_url;
  const title = item.title || item.name || '';
  return (
    <TVPressable
      onFocus={() => { setFoc(true); notifyRow?.(); }}
      onBlur={() => setFoc(false)}
      onPress={onPress}
      style={s.gridItem}
    >
      <View style={[s.gridFrame, foc && s.gridFrameFoc]}>
        <View style={s.gridImgWrap}>
          {img
            ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1a1a' }]} />
          }
          {foc && (
            <View style={s.cardOverlay}>
              <Ionicons name="play-circle" size={r(42)} color="rgba(255,255,255,0.95)" />
            </View>
          )}
        </View>
      </View>
      <Text style={[s.gridTitle, foc && s.gridTitleFoc]} numberOfLines={1}>{title}</Text>
    </TVPressable>
  );
}

// ─── Netflix-style search panel ───────────────────────────────────────────────
function SearchPanel({ query, onKey, results, defaultItems = [], loading, onSelect, onFocus: notifyFocus }) {
  const searchItems = [...results.movies, ...results.series];
  const allItems    = query ? searchItems : defaultItems;
  const suggestions = allItems.slice(0, 8);

  return (
    <View style={s.spRoot}>
      {/* Top: query display */}
      <View style={s.spHeader}>
        <Ionicons name="search" size={r(20)} color="#E50914" />
        {query ? (
          <Text style={s.spQueryTxt} numberOfLines={1}>
            {query}<Text style={s.spCursor}> |</Text>
          </Text>
        ) : (
          <Text style={s.spQueryPh} numberOfLines={1}>Digite para buscar…</Text>
        )}
        {loading && <ActivityIndicator color="#E50914" size="small" style={{ marginLeft: r(10) }} />}
      </View>

      {/* Body */}
      <View style={s.spBody}>
        {/* LEFT — keyboard + sugestões abaixo */}
        <View style={s.spLeft}>
          {/* Keyboard */}
          <View>
            {KB_ROWS.map((row, ri) => (
              <View key={ri} style={s.spKbRow}>
                {row.map((key, ki) => (
                  <KeyBtn
                    key={key}
                    label={key}
                    onPress={() => { onKey(key); notifyFocus?.(); }}
                    wide={key === 'SPC'}
                    hasTVPreferredFocus={ri === 1 && ki === 0}
                  />
                ))}
              </View>
            ))}
          </View>

          {/* Sugestões abaixo do teclado */}
          {suggestions.length > 0 && (
            <View style={s.spSugWrap}>
              <Text style={s.spSugLabel}>Sugestões</Text>
              {suggestions.map(item => (
                <SugItem
                  key={item.id}
                  item={item}
                  onPress={() => { onSelect(item); notifyFocus?.(); }}
                />
              ))}
            </View>
          )}
          {!loading && !!query && searchItems.length === 0 && (
            <Text style={s.spSugEmpty}>Nenhum resultado para "{query}"</Text>
          )}
        </View>

        {/* RIGHT — grid 3 colunas */}
        <View style={s.spRight}>
          <Text style={s.spGridLabel}>
            {query
              ? (allItems.length > 0
                  ? `${allItems.length} resultado${allItems.length !== 1 ? 's' : ''}`
                  : (!loading ? `Sem resultados para "${query}"` : ''))
              : 'Catálogo'}
          </Text>
          <FlatList
            key="grid"
            data={allItems}
            numColumns={GRID_COLS}
            keyExtractor={it => String(it.id)}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            columnWrapperStyle={{ gap: GRID_GAP, marginBottom: GRID_GAP }}
            contentContainerStyle={{ paddingBottom: r(32) }}
            renderItem={({ item }) => (
              <GridCard
                item={item}
                onPress={() => { onSelect(item); notifyFocus?.(); }}
                onFocus={notifyFocus}
              />
            )}
          />
        </View>
      </View>
    </View>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState({ icon, title, desc }) {
  return (
    <View style={s.emptyState}>
      <Ionicons name={icon} size={r(54)} color="#2a2a2a" />
      <Text style={s.emptyTitle}>{title}</Text>
      {!!desc && <Text style={s.emptyDesc}>{desc}</Text>}
    </View>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { logout } = useAuth();

  const [activeNav, setActiveNav]       = useState(0);
  const [featured, setFeatured]         = useState(null);
  const [sections, setSections]         = useState([]);
  const [watchlist, setWatchlist]       = useState([]);
  const [watchLoading, setWatchLoading] = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState({ movies: [], series: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(false);

  const sidebarW  = useRef(new Animated.Value(SIDEBAR_SM)).current;
  const overlayOp = useRef(new Animated.Value(0)).current;
  const labelOp   = useRef(new Animated.Value(0)).current;
  const [grabContentFocus,  setGrabContentFocus]  = useState(false);
  const [grabFirstNavFocus, setGrabFirstNavFocus] = useState(false);
  const sidebarVisited = useRef(false);
  const blurTimer = useRef(null);
  const searchTimer = useRef(null);

  // Sidebar animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(sidebarW,  { toValue: sidebarOpen ? SIDEBAR_LG : SIDEBAR_SM, duration: 220, useNativeDriver: false }),
      Animated.timing(overlayOp, { toValue: sidebarOpen ? 1 : 0, duration: 220, useNativeDriver: false }),
      Animated.timing(labelOp,   { toValue: sidebarOpen ? 1 : 0, duration: sidebarOpen ? 140 : 60, delay: sidebarOpen ? 90 : 0, useNativeDriver: true }),
    ]).start();
  }, [sidebarOpen]);

  // Search debounce
  useEffect(() => {
    if (activeNav !== 4) return;
    clearTimeout(searchTimer.current);
    if (!searchQuery.trim()) {
      setSearchResults({ movies: [], series: [] });
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const q = encodeURIComponent(searchQuery.trim());
        const [mr, sr] = await Promise.all([
          api.get(`/movies/search?q=${q}`).catch(() => ({ data: [] })),
          api.get(`/series/search?q=${q}`).catch(() => ({ data: [] })),
        ]);
        setSearchResults({ movies: Array.isArray(mr.data) ? mr.data : [], series: Array.isArray(sr.data) ? sr.data : [] });
      } finally {
        setSearchLoading(false);
      }
    }, 500);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery, activeNav]);

  // Load watchlist when tab selected
  useEffect(() => {
    if (activeNav === 3 && watchlist.length === 0) loadWatchlist();
  }, [activeNav]);

  // Called when "Início" (idx 0) receives focus
  const onHomeNavFoc = useCallback(() => {
    clearTimeout(blurTimer.current);
    setSidebarOpen(true);
    sidebarVisited.current = true;
    setGrabFirstNavFocus(false); // already on correct item
  }, []);

  // Called when any other nav item receives focus
  const onOtherNavFoc = useCallback(() => {
    clearTimeout(blurTimer.current);
    setSidebarOpen(true);
    if (!sidebarVisited.current) {
      sidebarVisited.current = true;
      setGrabFirstNavFocus(true); // redirect to Início
    }
  }, []);

  const onSidebarBlur = useCallback(() => { blurTimer.current = setTimeout(() => setSidebarOpen(false), 160); }, []);
  const onContentFoc  = useCallback(() => { clearTimeout(blurTimer.current); setSidebarOpen(false); }, []);

  useEffect(() => {
    loadData();
    return () => { clearTimeout(blurTimer.current); clearTimeout(searchTimer.current); };
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
      const a = d => (Array.isArray(d.data) ? d.data : []);
      const [fl, nm2, ns2, pm2, ps2] = [feat, nm, ns, pm, ps].map(a);
      setFeatured(fl[0] || nm2[0] || pm2[0] || null);
      setSections([
        { title: 'Lançamentos — Filmes', data: nm2, type: 'movie'  },
        { title: 'Lançamentos — Séries', data: ns2, type: 'series' },
        { title: 'Populares — Filmes',   data: pm2, type: 'movie'  },
        { title: 'Populares — Séries',   data: ps2, type: 'series' },
      ]);
    } catch {}
  }

  async function loadWatchlist() {
    setWatchLoading(true);
    try {
      const { data } = await api.get('/watchlist');
      setWatchlist(Array.isArray(data) ? data : []);
    } catch {
      setWatchlist([]);
    } finally {
      setWatchLoading(false);
    }
  }

  // Computed sections & hero based on active nav
  const visibleSections = useMemo(() => {
    if (activeNav === 0) return sections;
    if (activeNav === 1) return sections.filter(s => s.type === 'movie');
    if (activeNav === 2) return sections.filter(s => s.type === 'series');
    if (activeNav === 3) return watchlist.length > 0 ? [{ title: 'Minha Lista', data: watchlist, type: null }] : [];
    if (activeNav === 4) return [
      ...(searchResults.movies.length > 0 ? [{ title: 'Filmes', data: searchResults.movies, type: 'movie' }] : []),
      ...(searchResults.series.length > 0 ? [{ title: 'Séries', data: searchResults.series, type: 'series' }] : []),
    ];
    return [];
  }, [activeNav, sections, watchlist, searchResults]);

  const heroItem = useMemo(() => {
    if (activeNav === 4) return null;
    if (activeNav === 3) return watchlist[0] || null;
    if (activeNav === 1) return sections.find(s => s.type === 'movie')?.data?.[0] || null;
    if (activeNav === 2) return sections.find(s => s.type === 'series')?.data?.[0] || null;
    return featured;
  }, [activeNav, featured, sections, watchlist]);

  function openDetail(item, type) {
    navigation.navigate('Detail', { item, type: type || item.content_type || 'movie' });
  }

  function playFeatured() {
    if (!heroItem) return;
    const url = heroItem.file_dubbing || heroItem.file_subtitled || heroItem.file_cinema || heroItem.file_4k;
    if (url) navigation.navigate('Player', { url, title: heroItem.title || heroItem.name, poster: heroItem.backdrop_url });
  }

  const isSeries = item => item?.total_seasons !== undefined || item?.content_type === 'series';

  function selectNav(idx) {
    setActiveNav(idx);
    if (idx !== 4) setSearchQuery('');
    setSidebarOpen(false);
    setGrabContentFocus(true);
  }

  function handleSearchKey(key) {
    if (key === '⌫') {
      setSearchQuery(q => q.slice(0, -1));
    } else if (key === 'SPC') {
      setSearchQuery(q => (q.endsWith(' ') ? q : q + ' '));
    } else {
      setSearchQuery(q => q + key);
    }
  }

  return (
    <View style={s.root}>
      {heroItem?.backdrop_url
        ? <Image source={{ uri: heroItem.backdrop_url }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={3} />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0d0d0d' }]} />
      }
      <LinearGradient
        colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.55)', '#000']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
      />

      <View style={s.layout}>
        {/* ── Sidebar ── */}
        <View style={[s.sidebarSlot, { width: SIDEBAR_SM }]}>
          <Animated.View style={[s.sidebarPanel, { width: sidebarW }]}>
            <LinearGradient
              colors={['#161619', '#0e0e11', '#0b0b0d']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            />

            <View style={s.logoBox}>
              <View style={s.logoIconBox}>
                <Text style={s.logoIconTxt}>F</Text>
              </View>
              <Animated.Text style={[s.logoWordmark, { opacity: labelOp }]} numberOfLines={1}>
                LIXHOME
              </Animated.Text>
            </View>

            <View style={s.navDividerTop} />

            {NAV.map(n => (
              <NavItem
                key={n.idx}
                icon={n.icon}
                label={n.label}
                labelOp={labelOp}
                active={activeNav === n.idx}
                hasTVPreferredFocus={n.idx === 0 && grabFirstNavFocus}
                onFocus={n.idx === 0 ? onHomeNavFoc : onOtherNavFoc}
                onBlur={onSidebarBlur}
                onPress={() => selectNav(n.idx)}
              />
            ))}

            <View style={{ height: r(24) }} />
            <View style={s.navDivider} />

            <NavItem
              icon="log-out-outline"
              label="Sair"
              labelOp={labelOp}
              danger
              focusable={sidebarOpen}
              onFocus={onOtherNavFoc}
              onBlur={onSidebarBlur}
              onPress={logout}
            />
            <View style={{ height: r(16) }} />
          </Animated.View>
        </View>

        {/* ── Content ── */}
        <View style={s.content}>
          {/* Invisible focus landing — grabs focus when a sidebar item is pressed */}
          <Pressable
            focusable
            hasTVPreferredFocus={grabContentFocus}
            onFocus={() => setGrabContentFocus(false)}
            style={s.focusLanding}
          />

          {activeNav === 4 ? (
            <SearchPanel
              query={searchQuery}
              onKey={handleSearchKey}
              results={searchResults}
              defaultItems={(() => {
                const seen = new Set();
                return sections.flatMap(s => s.data).filter(it => {
                  if (seen.has(it.id)) return false;
                  seen.add(it.id); return true;
                }).slice(0, 20);
              })()}
              loading={searchLoading}
              onSelect={item => openDetail(item, item.total_seasons !== undefined ? 'series' : 'movie')}
              onFocus={onContentFoc}
            />
          ) : (
            <>
              <View style={[s.hero, { height: Math.round(H * 0.50) }]}>
                {heroItem && (
                  <>
                    <View style={s.heroBadges}>
                      {!!heroItem.age_rating && (
                        <View style={s.ageBadge}>
                          <Text style={s.ageBadgeTxt}>{heroItem.age_rating}+</Text>
                        </View>
                      )}
                      {!!(heroItem.year || heroItem.release_year || heroItem.year_start) && (
                        <Text style={s.heroMeta}>{heroItem.year || heroItem.release_year || heroItem.year_start}</Text>
                      )}
                      {heroItem.rating > 0 && (
                        <Text style={s.heroMeta}>★ {Number(heroItem.rating).toFixed(1)}</Text>
                      )}
                    </View>
                    <Text style={s.heroTitle} numberOfLines={2}>
                      {heroItem.title || heroItem.name}
                    </Text>
                    <Text style={s.heroSyn} numberOfLines={3}>
                      {heroItem.synopsis}
                    </Text>
                    <View style={s.heroActions}>
                      <HeroBtn icon="play" label="Assistir" primary hasTVPreferredFocus onPress={playFeatured} onFocus={onContentFoc} />
                      <HeroBtn icon="information-circle-outline" label="Mais Info" onPress={() => openDetail(heroItem, isSeries(heroItem) ? 'series' : 'movie')} onFocus={onContentFoc} />
                    </View>
                  </>
                )}
              </View>

              {activeNav === 3 && !watchLoading && watchlist.length === 0 && (
                <EmptyState icon="heart-outline" title="Lista vazia" desc="Adicione filmes e séries pelo celular para assistir aqui." />
              )}
              {activeNav === 3 && watchLoading && (
                <View style={s.emptyState}>
                  <ActivityIndicator color="#E50914" size="large" />
                </View>
              )}

              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {visibleSections.map((sec, i) => (
                  <ContentRow
                    key={i}
                    title={sec.title}
                    data={sec.data}
                    onSelect={item => openDetail(item, sec.type || item.content_type || 'movie')}
                    onFocus={onContentFoc}
                  />
                ))}
                <View style={{ height: r(40) }} />
              </ScrollView>
            </>
          )}

          {/* Dark overlay when sidebar open */}
          <Animated.View style={[s.contentOverlay, { opacity: overlayOp }]} pointerEvents="none" />
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  focusLanding: { width: 0, height: 0, opacity: 0 },
  layout: { flex: 1, flexDirection: 'row' },

  sidebarSlot: { zIndex: 20, overflow: 'visible' },
  sidebarPanel: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    zIndex: 20,
    borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },

  logoBox: {
    flexDirection: 'row', alignItems: 'center',
    height: r(72), paddingHorizontal: r(10), gap: r(10), overflow: 'hidden',
  },
  logoIconBox: {
    width: r(38), height: r(38), borderRadius: r(9),
    backgroundColor: '#E50914', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  logoIconTxt: { fontSize: r(22), fontWeight: '900', color: '#fff' },
  logoWordmark: { fontSize: r(17), fontWeight: '900', color: '#E50914', letterSpacing: r(2), flexShrink: 1 },

  navDividerTop: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: r(10), marginBottom: r(6) },
  navDivider:    { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: r(10), marginTop: r(4), marginBottom: r(6) },

  navItem: { paddingHorizontal: r(8), marginVertical: r(2) },
  navPill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: r(10), paddingVertical: r(10), paddingHorizontal: r(8),
    gap: r(12), minHeight: r(46),
  },
  navPillFoc:    { backgroundColor: '#E50914' },
  navPillDanger: { backgroundColor: 'rgba(229,9,20,0.25)' },
  navPillActive: { backgroundColor: 'rgba(255,255,255,0.07)' },
  navIconWrap: {
    width: r(34), height: r(34), borderRadius: r(8),
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  navActiveDot: {
    position: 'absolute', bottom: r(2), right: r(2),
    width: r(6), height: r(6), borderRadius: r(3), backgroundColor: '#E50914',
  },
  navLabel:    { fontSize: r(15), color: '#ccc', fontWeight: '600', flexShrink: 1, letterSpacing: 0.2 },
  navLabelFoc: { color: '#fff', fontWeight: '800' },

  content: { flex: 1, overflow: 'hidden' },
  contentOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 10 },

  // ── Netflix-style search panel ────────────────────────────────────────────
  spRoot: {
    flex: 1,
    paddingLeft: r(36), paddingRight: r(24), paddingTop: r(20), paddingBottom: r(12),
  },
  spHeader: {
    flexDirection: 'row', alignItems: 'center', gap: r(12),
    borderBottomWidth: 2, borderBottomColor: 'rgba(229,9,20,0.45)',
    paddingBottom: r(12), marginBottom: r(16),
  },
  spQueryTxt: { flex: 1, fontSize: r(26), fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  spQueryPh:  { flex: 1, fontSize: r(26), fontWeight: '400', color: '#282828' },
  spCursor:   { color: '#E50914' },

  spBody: { flex: 1, flexDirection: 'row', gap: r(20) },

  // LEFT panel: keyboard + sugestões
  spLeft: { width: LEFT_W, flexShrink: 0 },

  // Keyboard
  spKbRow: { flexDirection: 'row', gap: r(6), marginBottom: r(6) },
  kbKey: {
    width: r(50), height: r(44),
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: r(8), borderWidth: 2, borderColor: 'transparent',
    justifyContent: 'center', alignItems: 'center',
  },
  kbKeyFoc:  { backgroundColor: '#E50914', borderColor: '#E50914' },
  kbKeySpc:  { flex: 1, width: undefined },
  kbKeyDel:  { width: r(90) },
  kbKeyTxt:  { fontSize: r(14), fontWeight: '700', color: '#555' },
  kbKeyTxtFoc: { color: '#fff' },

  // Sugestões (abaixo do teclado)
  spSugWrap: {
    marginTop: r(14),
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: r(10),
  },
  spSugLabel: {
    color: '#3a3a3a', fontSize: r(10), fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: r(8),
  },
  sugItem: {
    flexDirection: 'row', alignItems: 'center', gap: r(10),
    paddingVertical: r(9), paddingHorizontal: r(10),
    borderRadius: r(8), borderWidth: 2, borderColor: 'transparent',
    marginBottom: r(2),
  },
  sugItemFoc: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.13)',
  },
  sugTxt:    { flex: 1, fontSize: r(14), color: '#555', fontWeight: '500' },
  sugTxtFoc: { color: '#fff', fontWeight: '700' },
  spSugEmpty: { color: '#2a2a2a', fontSize: r(12), fontStyle: 'italic', marginTop: r(8) },

  // RIGHT panel: 3-column card grid
  spRight: { flex: 1 },
  spGridLabel: {
    color: '#3a3a3a', fontSize: r(10), fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: r(12),
  },
  gridItem: { flex: 1 },
  gridFrame:    { borderWidth: r(3), borderColor: 'transparent', borderRadius: r(9), marginBottom: r(4) },
  gridFrameFoc: { borderColor: '#fff' },
  gridImgWrap:  { aspectRatio: 16 / 9, borderRadius: r(6), overflow: 'hidden', backgroundColor: '#1a1a1a' },
  gridTitle:    { fontSize: r(12), color: '#666', fontWeight: '500', paddingHorizontal: r(2) },
  gridTitleFoc: { color: '#fff', fontWeight: '700' },

  // Empty state
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: r(60) },
  emptyTitle: { color: '#444', fontSize: r(19), fontWeight: '700', marginTop: r(14), marginBottom: r(6) },
  emptyDesc:  { color: '#2e2e2e', fontSize: r(14), textAlign: 'center', maxWidth: W * 0.38 },

  // Hero
  hero: { justifyContent: 'flex-end', paddingHorizontal: r(40), paddingBottom: r(20) },
  heroBadges: { flexDirection: 'row', alignItems: 'center', gap: r(10), marginBottom: r(8) },
  ageBadge: { backgroundColor: '#E50914', paddingHorizontal: r(7), paddingVertical: r(2), borderRadius: r(4) },
  ageBadgeTxt: { color: '#fff', fontSize: r(13), fontWeight: '800' },
  heroMeta: { color: '#bbb', fontSize: r(15) },
  heroTitle: {
    fontSize: r(46), fontWeight: '900', color: '#fff',
    marginBottom: r(10), maxWidth: W * 0.5,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: r(8),
  },
  heroSyn: {
    fontSize: r(15), color: '#ddd', lineHeight: r(22),
    maxWidth: W * 0.44, marginBottom: r(22),
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: r(4),
  },
  heroActions: { flexDirection: 'row', gap: r(12) },
  heroBtn: { paddingHorizontal: r(26), paddingVertical: r(13), borderRadius: r(7), borderWidth: r(3), borderColor: 'transparent' },
  heroBtnPri: { backgroundColor: '#fff' },
  heroBtnSec: { backgroundColor: 'rgba(80,80,80,0.75)' },
  heroBtnFoc: { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.2)' },
  heroBtnRow: { flexDirection: 'row', alignItems: 'center', gap: r(10) },
  heroBtnTxt: { fontSize: r(16), fontWeight: '700', color: '#fff' },

  // Rows
  row: { marginBottom: r(22), paddingLeft: r(40) },
  rowTitle: { fontSize: r(19), fontWeight: '700', color: '#e5e5e5', marginBottom: r(10) },
  rowListWrap: { position: 'relative' },
  rowFade: { position: 'absolute', right: 0, top: 0, width: r(80), height: CARD_H, pointerEvents: 'none' },

  // Card
  cardFrame:    { borderWidth: r(3), borderColor: 'transparent', borderRadius: r(9) },
  cardFrameFoc: { borderColor: '#fff' },
  cardImgWrap: {
    width: CARD_W - r(6), height: CARD_H - r(6),
    borderRadius: r(6), overflow: 'hidden', backgroundColor: '#1a1a1a',
  },
  cardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  cardTitle:    { marginTop: r(5), fontSize: r(13), color: '#999', fontWeight: '500', width: CARD_W - r(6), paddingHorizontal: r(2) },
  cardTitleFoc: { color: '#fff', fontWeight: '700' },
});
