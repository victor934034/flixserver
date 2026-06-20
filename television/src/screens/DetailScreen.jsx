import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable,
  FlatList, ActivityIndicator, Dimensions, BackHandler, findNodeHandle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';

// ─── Scale ────────────────────────────────────────────────────────────────────
const { width: W, height: H } = Dimensions.get('window');
const S = Math.min(W / 1920, H / 1080);
const r = v => Math.max(1, Math.round(v * S));

const EP_W = r(200);
const EP_H = Math.round(EP_W * 9 / 16);

// ─── TVPressable ──────────────────────────────────────────────────────────────
const TVPressable = React.forwardRef(function TVPressable(
  { children, style, onPress, onFocus, onBlur, hasTVPreferredFocus, nextFocusRight },
  ref
) {
  return (
    <Pressable
      ref={ref}
      focusable={true}
      hasTVPreferredFocus={hasTVPreferredFocus}
      nextFocusRight={nextFocusRight}
      onFocus={onFocus}
      onBlur={onBlur}
      onPress={onPress}
      style={style}
    >
      {children}
    </Pressable>
  );
});

// ─── Back button ──────────────────────────────────────────────────────────────
function BackBtn({ onPress }) {
  const [foc, setFoc] = useState(false);
  return (
    <TVPressable
      onPress={onPress}
      onFocus={() => setFoc(true)}
      onBlur={() => setFoc(false)}
      style={[s.backBtn, foc && s.backBtnFoc]}
    >
      <Ionicons name="arrow-back" size={r(22)} color="#fff" />
      {foc && <Text style={s.backBtnTxt}>Voltar</Text>}
    </TVPressable>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────
function ActionBtn({ label, sublabel, icon, onPress, primary, hasTVPreferredFocus, nextFocusRight }) {
  const [foc, setFoc] = useState(false);
  return (
    <TVPressable
      hasTVPreferredFocus={hasTVPreferredFocus}
      nextFocusRight={nextFocusRight}
      onPress={onPress}
      onFocus={() => setFoc(true)}
      onBlur={() => setFoc(false)}
      style={[s.actionBtn, primary ? s.actionBtnPri : s.actionBtnSec, foc && s.actionBtnFoc]}
    >
      <View style={s.actionBtnRow}>
        <View style={[s.actionBtnIcon, primary && !foc && s.actionBtnIconDark]}>
          <Ionicons name={icon} size={r(18)} color={primary && !foc ? '#000' : '#fff'} />
        </View>
        <View>
          <Text style={[s.actionBtnTxt, primary && !foc && { color: '#000' }]}>{label}</Text>
          {!!sublabel && <Text style={[s.actionBtnSub, primary && !foc && { color: 'rgba(0,0,0,0.55)' }]}>{sublabel}</Text>}
        </View>
      </View>
    </TVPressable>
  );
}

// ─── Season selector  (< Temporada N >) ──────────────────────────────────────
function SeasonArrowBtn({ icon, disabled, onPress }) {
  const [foc, setFoc] = useState(false);
  return (
    <TVPressable
      onPress={() => !disabled && onPress()}
      onFocus={() => { setFoc(true); !disabled && onPress(); }}
      onBlur={() => setFoc(false)}
      style={[
        s.seasonArrow,
        foc && s.seasonArrowFoc,
        disabled && s.seasonArrowOff,
      ]}
    >
      <Ionicons
        name={icon}
        size={r(18)}
        color={disabled ? '#2a2a2a' : foc ? '#fff' : '#888'}
      />
    </TVPressable>
  );
}

function SeasonSelector({ seasons, season, onSelect }) {
  const idx = seasons.indexOf(season);
  return (
    <View style={s.seasonSelector}>
      <SeasonArrowBtn
        icon="chevron-back"
        disabled={idx <= 0}
        onPress={() => onSelect(seasons[idx - 1])}
      />
      <View style={s.seasonCurrent}>
        <Text style={s.seasonNum}>Temporada {season}</Text>
        <Text style={s.seasonOf}>{idx + 1} de {seasons.length}</Text>
      </View>
      <SeasonArrowBtn
        icon="chevron-forward"
        disabled={idx >= seasons.length - 1}
        onPress={() => onSelect(seasons[idx + 1])}
      />
    </View>
  );
}

// ─── Episode item ─────────────────────────────────────────────────────────────
const EpisodeItem = React.forwardRef(function EpisodeItem({ ep, onPress }, ref) {
  const [foc, setFoc] = useState(false);
  const hasFile = !!(ep.file_dubbing || ep.file_subtitled || ep.file_cinema);

  return (
    <TVPressable
      ref={ref}
      onFocus={() => setFoc(true)}
      onBlur={() => setFoc(false)}
      onPress={() => hasFile && onPress(ep)}
      style={[s.epItem, foc && s.epItemFoc, !hasFile && s.epItemOff]}
    >
      {/* Left accent bar when focused */}
      {foc && <View style={s.epAccent} />}

      <View style={s.epInner}>
        {/* Thumbnail */}
        <View style={[s.epThumb, foc && s.epThumbFoc]}>
          {ep.thumbnail_url
            ? <Image source={{ uri: ep.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : (
              <View style={[StyleSheet.absoluteFill, s.epThumbPh]}>
                <Text style={s.epThumbNum}>{ep.episode_number}</Text>
              </View>
            )
          }
          {foc && hasFile && (
            <View style={s.epThumbOverlay}>
              <Ionicons name="play-circle" size={r(44)} color="#fff" />
            </View>
          )}
          {!foc && (
            <View style={s.epDurBadge}>
              <Text style={s.epDurTxt}>{ep.duration ? `${ep.duration}m` : '—'}</Text>
            </View>
          )}
        </View>

        {/* Text */}
        <View style={s.epText}>
          <Text style={s.epCode}>
            EP {String(ep.episode_number).padStart(2, '0')}
            {ep.air_date ? `  ·  ${ep.air_date.slice(0, 4)}` : ''}
          </Text>
          <Text style={[s.epTitle, foc && s.epTitleFoc]} numberOfLines={2}>
            {ep.title || `Episódio ${ep.episode_number}`}
          </Text>
          {!!ep.synopsis && (
            <Text style={s.epSynopsis} numberOfLines={foc ? 3 : 2}>{ep.synopsis}</Text>
          )}
          {!hasFile && (
            <Text style={s.epUnavail}>Não disponível</Text>
          )}
        </View>

        {/* Arrow hint */}
        <View style={[s.epArrow, !foc && { opacity: 0 }]}>
          <Ionicons name="play" size={r(16)} color="#fff" />
        </View>
      </View>
    </TVPressable>
  );
});

// ─── DetailScreen ─────────────────────────────────────────────────────────────
export default function DetailScreen({ navigation, route }) {
  const { item, type } = route.params;
  const isSeries = type === 'series';

  const [detail, setDetail]     = useState(item);
  const [episodes, setEpisodes] = useState([]);
  const [season, setSeason]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const epListRef  = useRef(null);
  const firstEpRef = useRef(null);
  const [firstEpHandle, setFirstEpHandle] = useState(null);

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => { navigation.goBack(); return true; });
    return () => h.remove();
  }, []);

  useEffect(() => {
    const endpoint = isSeries ? `/series/${item.id}` : `/movies/${item.id}`;
    const promises = [api.get(endpoint).catch(() => ({ data: item }))];
    if (isSeries) promises.push(api.get(`/series/${item.id}/episodes`).catch(() => ({ data: [] })));

    Promise.all(promises).then(([detRes, epRes]) => {
      setDetail(detRes.data || item);
      if (isSeries) {
        const eps = Array.isArray(epRes?.data) ? epRes.data : [];
        setEpisodes(eps);
        if (eps.length > 0) setSeason(eps[0].season_number);
      }
    }).finally(() => setLoading(false));
  }, [item.id]);

  // After first episode mounts, capture its node handle for nextFocusRight
  useEffect(() => {
    if (firstEpRef.current) {
      const h = findNodeHandle(firstEpRef.current);
      if (h) setFirstEpHandle(h);
    }
  }, [loading, season]);

  const seasons = [...new Set(episodes.map(e => e.season_number))].sort((a, b) => a - b);
  const currentEps = episodes
    .filter(e => e.season_number === season)
    .sort((a, b) => a.episode_number - b.episode_number);

  function selectSeason(n) {
    setSeason(n);
    try { epListRef.current?.scrollToOffset({ offset: 0, animated: false }); } catch {}
  }

  function playMovie(version) {
    const url = detail[`file_${version}`] || detail.file_dubbing || detail.file_subtitled || detail.file_cinema;
    if (!url) return;
    navigation.navigate('Player', {
      url,
      title: detail.title || detail.name,
      poster: detail.backdrop_url,
      tracks: {
        dubbing:   detail.file_dubbing   || null,
        subtitled: detail.file_subtitled || null,
        cinema:    detail.file_cinema    || null,
      },
      subtitles: {
        pt: detail.subtitle_pt || null,
        en: detail.subtitle_en || null,
        es: detail.subtitle_es || null,
      },
    });
  }

  function playEpisode(ep) {
    const url = ep.file_dubbing || ep.file_subtitled || ep.file_cinema;
    if (!url) return;
    const epLabel = `T${ep.season_number}E${String(ep.episode_number).padStart(2, '0')}`;
    const title = `${detail.title || detail.name} · ${epLabel}${ep.title ? ` · ${ep.title}` : ''}`;
    navigation.navigate('Player', {
      url,
      title,
      poster: ep.thumbnail_url || detail.backdrop_url,
      tracks: {
        dubbing:   ep.file_dubbing   || null,
        subtitled: ep.file_subtitled || null,
        cinema:    ep.file_cinema    || null,
      },
      subtitles: {
        pt: ep.subtitle_pt || null,
        en: ep.subtitle_en || null,
        es: ep.subtitle_es || null,
      },
      skipIntroTo: 90_000,
      seriesContext: {
        seriesTitle: detail.title || detail.name,
        backdropUrl: detail.backdrop_url,
        episodes:    currentEps,
        currentEpId: ep.id,
      },
    });
  }

  const versions = [];
  if (detail.file_dubbing)   versions.push({ key: 'dubbing',   label: 'Dublado',   sub: 'Áudio português', icon: 'volume-high' });
  if (detail.file_subtitled) versions.push({ key: 'subtitled', label: 'Legendado',  sub: 'Áudio original',  icon: 'subtitles-outline' });
  if (detail.file_cinema)    versions.push({ key: 'cinema',    label: 'Cinema',     sub: null,              icon: 'film-outline' });
  if (detail.file_4k)        versions.push({ key: '4k',        label: '4K HDR',     sub: 'Ultra HD',        icon: 'diamond-outline' });

  const firstEp = currentEps[0];

  return (
    <View style={s.root}>
      {/* Full-screen backdrop */}
      {detail.backdrop_url
        ? <Image source={{ uri: detail.backdrop_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0d0d0d' }]} />
      }
      {/* Bottom-to-top dark overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)', '#000']}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Left panel overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.97)', 'rgba(0,0,0,0.7)', 'transparent']}
        style={[StyleSheet.absoluteFill, { width: W * 0.52 }]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
      />

      {/* Back button */}
      <BackBtn onPress={() => navigation.goBack()} />

      <View style={s.layout}>
        {/* ── Left: info ── */}
        <View style={s.infoPanel}>
          {/* Fixed top */}
          <View style={s.infoTop}>
            <View style={s.badgeRow}>
              {!!detail.age_rating && (
                <View style={s.ageBadge}><Text style={s.ageBadgeTxt}>{detail.age_rating}+</Text></View>
              )}
              {isSeries && !!detail.total_seasons && (
                <View style={s.tagBadge}><Text style={s.tagBadgeTxt}>{detail.total_seasons} temporada{detail.total_seasons > 1 ? 's' : ''}</Text></View>
              )}
              {isSeries && !!detail.status && (
                <View style={[s.tagBadge, detail.status === 'ongoing' && s.tagBadgeGreen]}>
                  <Text style={s.tagBadgeTxt}>{detail.status === 'ongoing' ? 'Em exibição' : 'Encerrada'}</Text>
                </View>
              )}
            </View>

            <Text style={s.title} numberOfLines={2}>{detail.title || detail.name}</Text>

            <View style={s.metaRow}>
              {!!(detail.year || detail.year_start) && (
                <Text style={s.metaItem}>{detail.year || detail.year_start}</Text>
              )}
              {!!detail.duration && (
                <Text style={s.metaItem}>{detail.duration} min</Text>
              )}
              {detail.rating > 0 && (
                <View style={s.ratingChip}>
                  <Ionicons name="star" size={r(12)} color="#f59e0b" />
                  <Text style={s.ratingTxt}>{Number(detail.rating).toFixed(1)}</Text>
                </View>
              )}
            </View>

            {Array.isArray(detail.genres) && detail.genres.length > 0 && (
              <View style={s.genreRow}>
                {detail.genres.slice(0, 4).map(g => (
                  <View key={g} style={s.genreChip}>
                    <Text style={s.genreTxt}>{g}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Flexible middle: synopsis */}
          {!!detail.synopsis && (
            <Text style={s.synopsis} numberOfLines={4}>{detail.synopsis}</Text>
          )}

          {/* Fixed bottom: buttons + season selector */}
          <View style={s.infoBottom}>
            {/* Filmes: botões empilhados */}
            {!isSeries && (
              <View style={s.actions}>
                {versions.map((v, i) => (
                  <ActionBtn
                    key={v.key}
                    label={v.label}
                    sublabel={v.sub}
                    icon={v.icon}
                    primary={i === 0}
                    hasTVPreferredFocus={i === 0}
                    onPress={() => playMovie(v.key)}
                  />
                ))}
              </View>
            )}

            {/* Séries: Assistir e seletor de temporada empilhados */}
            {isSeries && !!firstEp && (
              <View style={s.seriesStack}>
                <ActionBtn
                  label="Assistir"
                  sublabel={`T${firstEp.season_number} · EP ${String(firstEp.episode_number).padStart(2, '0')}${firstEp.title ? ` — ${firstEp.title}` : ''}`}
                  icon="play"
                  primary
                  hasTVPreferredFocus
                  nextFocusRight={firstEpHandle}
                  onPress={() => playEpisode(firstEp)}
                />
                {seasons.length > 1 && (
                  <SeasonSelector seasons={seasons} season={season} onSelect={selectSeason} />
                )}
              </View>
            )}
          </View>
        </View>

        {/* ── Right: episode list ── */}
        {isSeries && (
          <View style={s.epPanel}>
            {/* Header */}
            <View style={s.epHeader}>
              <Text style={s.epHeaderTitle}>
                {seasons.length > 1 ? `Temporada ${season}` : 'Episódios'}
              </Text>
              {!loading && (
                <Text style={s.epHeaderCount}>{currentEps.length} ep.</Text>
              )}
            </View>

            {/* Separator */}
            <View style={s.epHeaderLine} />

            {loading ? (
              <View style={s.epLoading}>
                <ActivityIndicator color="#E50914" size="large" />
              </View>
            ) : (
              <FlatList
                ref={epListRef}
                data={currentEps}
                keyExtractor={ep => String(ep.id)}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={false}
                contentContainerStyle={{ paddingBottom: r(40) }}
                renderItem={({ item: ep, index }) => (
                  <EpisodeItem
                    ref={index === 0 ? firstEpRef : null}
                    ep={ep}
                    onPress={playEpisode}
                  />
                )}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  layout: { flex: 1, flexDirection: 'row' },

  // Back
  backBtn: {
    position: 'absolute', top: r(20), left: r(20), zIndex: 30,
    flexDirection: 'row', alignItems: 'center', gap: r(8),
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: r(30), paddingVertical: r(9), paddingHorizontal: r(14),
    borderWidth: 2, borderColor: 'transparent',
  },
  backBtnFoc: { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.12)' },
  backBtnTxt: { color: '#fff', fontSize: r(15), fontWeight: '700' },

  // Info panel — content starts from top, uses all available space
  infoPanel: {
    width: W * 0.44,
    paddingTop: r(68),
    paddingHorizontal: r(44),
    paddingBottom: r(28),
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  infoTop: { marginBottom: r(10) },

  badgeRow: { flexDirection: 'row', gap: r(8), marginBottom: r(14), flexWrap: 'wrap' },
  ageBadge: {
    backgroundColor: '#E50914', borderRadius: r(4),
    paddingHorizontal: r(8), paddingVertical: r(3),
  },
  ageBadgeTxt: { color: '#fff', fontSize: r(12), fontWeight: '900' },
  tagBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: r(4),
    paddingHorizontal: r(10), paddingVertical: r(3),
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  tagBadgeGreen: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.3)' },
  tagBadgeTxt: { color: '#ccc', fontSize: r(12), fontWeight: '600' },

  title: {
    fontSize: r(42), fontWeight: '900', color: '#fff',
    lineHeight: r(50), marginBottom: r(10),
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: r(6),
  },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: r(12), marginBottom: r(10), flexWrap: 'wrap' },
  metaItem: { color: '#888', fontSize: r(14) },
  ratingChip: {
    flexDirection: 'row', alignItems: 'center', gap: r(4),
    backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: r(6),
    paddingHorizontal: r(8), paddingVertical: r(2),
  },
  ratingTxt: { color: '#f59e0b', fontSize: r(14), fontWeight: '700' },

  genreRow: { flexDirection: 'row', gap: r(6), flexWrap: 'wrap', marginBottom: r(4) },
  genreChip: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
    borderRadius: r(16), paddingHorizontal: r(10), paddingVertical: r(3),
  },
  genreTxt: { color: '#888', fontSize: r(12) },

  synopsis: {
    color: '#aaa', fontSize: r(15), lineHeight: r(24),
    marginBottom: r(20),
  },

  infoBottom: { marginTop: r(4) },

  // Action buttons
  actions: { gap: r(6), marginBottom: r(8) },
  actionBtn: {
    borderRadius: r(10), paddingVertical: r(10), paddingHorizontal: r(16),
    borderWidth: r(2), borderColor: 'transparent',
  },
  actionBtnPri: { backgroundColor: '#fff' },
  actionBtnSec: { backgroundColor: 'rgba(60,60,60,0.85)' },
  actionBtnFoc: { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.15)' },
  actionBtnRow: { flexDirection: 'row', alignItems: 'center', gap: r(12) },
  actionBtnIcon: {
    width: r(32), height: r(32), borderRadius: r(16),
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  actionBtnIconDark: { backgroundColor: 'rgba(0,0,0,0.12)' },
  actionBtnTxt: { fontSize: r(16), fontWeight: '800', color: '#fff' },
  actionBtnSub: { fontSize: r(12), color: 'rgba(255,255,255,0.55)', marginTop: r(1) },

  // Series stacked: Assistir then season selector below
  seriesStack: {
    gap: r(8),
  },

  // Season selector
  seasonSelector: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: r(10), paddingVertical: r(4), paddingHorizontal: r(4),
    flexDirection: 'row', alignItems: 'center',
    minWidth: r(130),
  },
  seasonSelectorLabel: { display: 'none' },
  seasonRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  seasonArrow: {
    width: r(36), height: r(36),
    justifyContent: 'center', alignItems: 'center',
    borderRadius: r(8),
    borderWidth: 2, borderColor: 'transparent',
  },
  seasonArrowFoc: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  seasonArrowOff: { opacity: 0.2 },
  seasonCurrent: { flex: 1, alignItems: 'center', paddingVertical: r(2) },
  seasonNum: { fontSize: r(13), fontWeight: '800', color: '#fff' },
  seasonOf: { fontSize: r(10), color: '#555', fontWeight: '600' },

  // Episode panel
  epPanel: {
    flex: 1, paddingTop: r(20),
    paddingLeft: r(8), paddingRight: r(28),
  },
  epHeader: { flexDirection: 'row', alignItems: 'baseline', gap: r(10), marginBottom: r(8) },
  epHeaderTitle: { color: '#fff', fontSize: r(18), fontWeight: '800' },
  epHeaderCount: { color: '#444', fontSize: r(13), fontWeight: '600' },
  epHeaderLine: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: r(8) },
  epLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Episode item
  epItem: {
    borderRadius: r(10), marginBottom: r(4),
    borderWidth: 2, borderColor: 'transparent',
    overflow: 'hidden',
  },
  epItemFoc: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  epItemOff: { opacity: 0.35 },
  epAccent: {
    position: 'absolute', left: 0, top: r(10), bottom: r(10),
    width: r(3), backgroundColor: '#E50914', borderRadius: r(2),
    zIndex: 1,
  },
  epInner: {
    flexDirection: 'row', alignItems: 'center',
    gap: r(12), padding: r(10),
  },

  epThumb: {
    width: EP_W, height: EP_H,
    borderRadius: r(6), overflow: 'hidden',
    backgroundColor: '#161616', flexShrink: 0,
    borderWidth: 2, borderColor: 'transparent',
  },
  epThumbFoc: { borderColor: 'rgba(255,255,255,0.3)' },
  epThumbPh: { justifyContent: 'center', alignItems: 'center' },
  epThumbNum: { color: '#2a2a2a', fontSize: r(28), fontWeight: '900' },
  epThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  epDurBadge: {
    position: 'absolute', bottom: r(4), right: r(4),
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: r(5), paddingVertical: r(2), borderRadius: r(4),
  },
  epDurTxt: { color: '#ccc', fontSize: r(11), fontWeight: '600' },

  epText: { flex: 1 },
  epCode: { color: '#555', fontSize: r(11), fontWeight: '700', marginBottom: r(3), letterSpacing: 0.5 },
  epTitle: { color: '#bbb', fontSize: r(14), fontWeight: '600', marginBottom: r(4), lineHeight: r(18) },
  epTitleFoc: { color: '#fff', fontWeight: '800' },
  epSynopsis: { color: '#555', fontSize: r(12), lineHeight: r(17) },
  epUnavail: { color: '#3a3a3a', fontSize: r(12), fontStyle: 'italic', marginTop: r(4) },

  epArrow: {
    width: r(28), height: r(28), borderRadius: r(14),
    backgroundColor: '#E50914',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
});
