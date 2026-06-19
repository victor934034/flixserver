import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableHighlight,
  ScrollView, FlatList, ActivityIndicator, Dimensions, BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';

const { width: W, height: H } = Dimensions.get('window');

function ActionButton({ label, icon, onPress, primary, hasTVPreferredFocus, onFocus, onBlur }) {
  const [focused, setFocused] = useState(false);
  return (
    <TouchableHighlight
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      onFocus={() => { setFocused(true); onFocus?.(); }}
      onBlur={() => { setFocused(false); onBlur?.(); }}
      underlayColor="transparent"
      style={[
        styles.actionBtn,
        primary ? styles.actionBtnPrimary : styles.actionBtnSecondary,
        focused && styles.actionBtnFocused,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name={icon} size={20} color={primary ? '#000' : '#fff'} />
        <Text style={[styles.actionBtnText, primary && { color: '#000' }]}>{label}</Text>
      </View>
    </TouchableHighlight>
  );
}

function EpisodeItem({ ep, onPress }) {
  const [focused, setFocused] = useState(false);
  const hasFile = ep.file_dubbing || ep.file_subtitled || ep.file_cinema;

  return (
    <TouchableHighlight
      onPress={() => hasFile && onPress(ep)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      underlayColor="transparent"
      style={[styles.epItem, focused && styles.epItemFocused, !hasFile && styles.epItemDisabled]}
    >
      <View style={styles.epItemInner}>
        <View style={styles.epThumb}>
          {ep.thumbnail_url
            ? <Image source={{ uri: ep.thumbnail_url }} style={styles.epThumbImg} />
            : (
              <View style={styles.epThumbPlaceholder}>
                <Text style={styles.epNumBig}>{ep.episode_number}</Text>
              </View>
            )
          }
          {hasFile && (
            <View style={[styles.epPlayIcon, focused && { opacity: 1 }]}>
              <Ionicons name="play-circle" size={28} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.epText}>
          <Text style={styles.epCode}>
            T{ep.season_number}E{String(ep.episode_number).padStart(2, '0')}
          </Text>
          <Text style={styles.epTitle} numberOfLines={1}>
            {ep.title || `Episódio ${ep.episode_number}`}
          </Text>
          {ep.synopsis
            ? <Text style={styles.epSynopsis} numberOfLines={2}>{ep.synopsis}</Text>
            : null
          }
          {ep.duration
            ? <Text style={styles.epDur}>{ep.duration} min</Text>
            : null
          }
        </View>
        {focused && hasFile && (
          <Ionicons name="chevron-forward" size={22} color="#fff" style={{ marginLeft: 'auto' }} />
        )}
      </View>
    </TouchableHighlight>
  );
}

export default function DetailScreen({ navigation, route }) {
  const { item, type } = route.params;
  const isSeries = type === 'series';

  const [detail, setDetail] = useState(item);
  const [episodes, setEpisodes] = useState([]);
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [focusedSeason, setFocusedSeason] = useState(null);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => handler.remove();
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

  const seasons = [...new Set(episodes.map(e => e.season_number))].sort((a, b) => a - b);
  const currentEps = episodes
    .filter(e => e.season_number === season)
    .sort((a, b) => a.episode_number - b.episode_number);

  function playMovie(version) {
    const url = detail[`file_${version}`] || detail.file_dubbing || detail.file_subtitled || detail.file_cinema || detail.file_4k;
    if (!url) return;
    navigation.navigate('Player', { url, title: detail.title, poster: detail.backdrop_url });
  }

  function playEpisode(ep) {
    const url = ep.file_dubbing || ep.file_subtitled || ep.file_cinema;
    if (!url) return;
    const title = `${detail.title} · T${ep.season_number}E${String(ep.episode_number).padStart(2, '0')}${ep.title ? ` · ${ep.title}` : ''}`;
    navigation.navigate('Player', { url, title, poster: ep.thumbnail_url || detail.backdrop_url });
  }

  const availableVersions = [];
  if (detail.file_dubbing) availableVersions.push({ key: 'dubbing', label: 'Dublado' });
  if (detail.file_subtitled) availableVersions.push({ key: 'subtitled', label: 'Legendado' });
  if (detail.file_cinema) availableVersions.push({ key: 'cinema', label: 'Cinema' });
  if (detail.file_4k) availableVersions.push({ key: '4k', label: '4K' });

  return (
    <View style={styles.container}>
      {/* Backdrop */}
      {detail.backdrop_url
        ? <Image source={{ uri: detail.backdrop_url }} style={styles.backdrop} />
        : <View style={[styles.backdrop, { backgroundColor: '#111' }]} />
      }
      <LinearGradient
        colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)', '#000']}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.88)', 'transparent']}
        style={[StyleSheet.absoluteFill, { width: W * 0.52 }]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
      />

      {/* Back button */}
      <TouchableHighlight
        onPress={() => navigation.goBack()}
        underlayColor="rgba(255,255,255,0.1)"
        style={styles.backBtn}
      >
        <Ionicons name="arrow-back" size={26} color="#fff" />
      </TouchableHighlight>

      <View style={styles.layout}>
        {/* Left: info */}
        <View style={styles.infoPanel}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.infoPadding}>
              {detail.age_rating && (
                <View style={styles.ageBadge}>
                  <Text style={styles.ageBadgeText}>{detail.age_rating}+</Text>
                </View>
              )}

              <Text style={styles.title} numberOfLines={3}>{detail.title}</Text>

              <View style={styles.metaRow}>
                {(detail.year || detail.year_start) && (
                  <Text style={styles.metaItem}>{detail.year || detail.year_start}</Text>
                )}
                {detail.total_seasons && (
                  <Text style={styles.metaItem}>{detail.total_seasons} temp.</Text>
                )}
                {detail.duration && (
                  <Text style={styles.metaItem}>{detail.duration} min</Text>
                )}
                {detail.rating > 0 && (
                  <Text style={[styles.metaItem, { color: '#ffa500' }]}>
                    ★ {Number(detail.rating).toFixed(1)}
                  </Text>
                )}
              </View>

              {detail.synopsis ? (
                <Text style={styles.synopsis} numberOfLines={5}>{detail.synopsis}</Text>
              ) : null}

              {Array.isArray(detail.genres) && detail.genres.length > 0 && (
                <Text style={styles.genres}>{detail.genres.join(' · ')}</Text>
              )}

              {/* Movie: version buttons */}
              {!isSeries && availableVersions.length > 0 && (
                <View style={styles.versionBtns}>
                  {availableVersions.map((v, i) => (
                    <ActionButton
                      key={v.key}
                      label={v.label}
                      icon={i === 0 ? 'play' : 'play-outline'}
                      primary={i === 0}
                      hasTVPreferredFocus={i === 0}
                      onPress={() => playMovie(v.key)}
                    />
                  ))}
                </View>
              )}

              {/* Series: play first episode */}
              {isSeries && currentEps.length > 0 && (
                <ActionButton
                  label="Assistir"
                  icon="play"
                  primary
                  hasTVPreferredFocus
                  onPress={() => playEpisode(currentEps[0])}
                />
              )}
            </View>
          </ScrollView>
        </View>

        {/* Right: episode list (series only) */}
        {isSeries && (
          <View style={styles.episodePanel}>
            {loading
              ? <ActivityIndicator color="#E50914" style={{ marginTop: 60 }} />
              : (
                <>
                  {/* Season tabs */}
                  {seasons.length > 1 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.seasonTabs}
                    >
                      {seasons.map(s => (
                        <TouchableHighlight
                          key={s}
                          onPress={() => setSeason(s)}
                          onFocus={() => { setFocusedSeason(s); setSeason(s); }}
                          onBlur={() => setFocusedSeason(null)}
                          underlayColor="transparent"
                          style={[
                            styles.seasonTab,
                            s === season && styles.seasonTabActive,
                            focusedSeason === s && styles.seasonTabFocused,
                          ]}
                        >
                          <Text style={[
                            styles.seasonTabText,
                            s === season && styles.seasonTabTextActive,
                          ]}>
                            T{s}
                          </Text>
                        </TouchableHighlight>
                      ))}
                    </ScrollView>
                  )}

                  {/* Episodes */}
                  <FlatList
                    data={currentEps}
                    keyExtractor={ep => String(ep.id)}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item: ep }) => (
                      <EpisodeItem ep={ep} onPress={playEpisode} />
                    )}
                  />
                </>
              )
            }
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    width: W, height: H,
    resizeMode: 'cover',
  },
  backBtn: {
    position: 'absolute',
    top: 24, left: 24, zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 24, padding: 10,
  },
  layout: { flex: 1, flexDirection: 'row' },

  // Left info panel
  infoPanel: { width: W * 0.44, paddingTop: 24 },
  infoPadding: { paddingHorizontal: 48, paddingTop: 48, paddingBottom: 40 },
  ageBadge: {
    backgroundColor: '#E50914',
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 4, marginBottom: 14,
  },
  ageBadgeText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  title: {
    fontSize: 46,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 14,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  metaItem: { color: '#aaa', fontSize: 16 },
  synopsis: {
    color: '#ccc', fontSize: 17, lineHeight: 26,
    marginBottom: 14,
  },
  genres: { color: '#777', fontSize: 15, marginBottom: 28 },
  versionBtns: { gap: 12 },
  actionBtn: {
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 6, marginBottom: 4,
    borderWidth: 2, borderColor: 'transparent',
  },
  actionBtnPrimary: { backgroundColor: '#fff' },
  actionBtnSecondary: { backgroundColor: 'rgba(109,109,110,0.7)', borderColor: 'transparent' },
  actionBtnFocused: { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.15)' },
  actionBtnText: { fontSize: 18, fontWeight: '700', color: '#fff' },

  // Right episode panel
  episodePanel: {
    flex: 1,
    paddingTop: 72,
    paddingRight: 32,
    paddingLeft: 16,
  },
  seasonTabs: { marginBottom: 20 },
  seasonTab: {
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 20, marginRight: 10,
    borderWidth: 1, borderColor: '#333',
  },
  seasonTabActive: { backgroundColor: '#E50914', borderColor: '#E50914' },
  seasonTabFocused: { borderColor: '#fff' },
  seasonTabText: { color: '#aaa', fontSize: 16, fontWeight: '600' },
  seasonTabTextActive: { color: '#fff' },

  // Episode item
  epItem: {
    borderRadius: 8,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  epItemFocused: { backgroundColor: 'rgba(255,255,255,0.12)' },
  epItemDisabled: { opacity: 0.4 },
  epItemInner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  epThumb: {
    width: 128, height: 72, borderRadius: 6,
    overflow: 'hidden', backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  epThumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  epThumbPlaceholder: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  epNumBig: { color: '#444', fontSize: 22, fontWeight: '700' },
  epPlayIcon: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    opacity: 0,
  },
  epText: { flex: 1 },
  epCode: { color: '#666', fontSize: 13, marginBottom: 4 },
  epTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  epSynopsis: { color: '#777', fontSize: 14, lineHeight: 20 },
  epDur: { color: '#555', fontSize: 13, marginTop: 4 },
});
