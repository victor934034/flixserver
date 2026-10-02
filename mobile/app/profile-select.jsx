import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Modal, TextInput, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useProfile, AVATARS, getAvatar } from '../contexts/ProfileContext';
import api from '../lib/api';
import CachedImage from '../components/CachedImage';

const isUrl = (s) => typeof s === 'string' && s.startsWith('http');

function AvatarCircle({ avatarId, size = 72 }) {
  if (isUrl(avatarId)) {
    return (
      <CachedImage
        source={{ uri: avatarId }}
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.22) }}
      />
    );
  }
  const av = getAvatar(avatarId);
  return (
    <View style={[styles.emojiCircle, { width: size, height: size, borderRadius: Math.round(size * 0.22), backgroundColor: av.color }]}>
      <Text style={{ fontSize: size * 0.44 }}>{av.emoji}</Text>
    </View>
  );
}

function ProfileCard({ profile, onPress, onLongPress }) {
  return (
    <TouchableOpacity style={styles.profileCard} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.75}>
      <View style={styles.profileAvatarWrap}>
        <AvatarCircle avatarId={profile.avatar} size={82} />
        {profile.is_kids && (
          <View style={styles.kidsOverlay}>
            <Text style={{ fontSize: 12 }}>👶</Text>
          </View>
        )}
      </View>
      <Text style={styles.profileName} numberOfLines={1}>{profile.name}</Text>
      {profile.is_kids && <Text style={styles.kidsTag}>Infantil</Text>}
    </TouchableOpacity>
  );
}

export default function ProfileSelectScreen() {
  const { user } = useAuth();
  const { selectProfile, loadSavedProfile } = useProfile();
  const router = useRouter();

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('avatar_1');
  const [isKids, setIsKids] = useState(false);
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [presetAvatars, setPresetAvatars] = useState([]);
  const [avatarTab, setAvatarTab] = useState('fotos'); // 'fotos' | 'emoji'

  // PIN pra abrir um perfil protegido
  const [pinPrompt, setPinPrompt] = useState(null); // perfil pendente de confirmação
  const [pinPromptValue, setPinPromptValue] = useState('');
  const [pinPromptError, setPinPromptError] = useState(false);
  const [pinChecking, setPinChecking] = useState(false);

  const fetchProfiles = useCallback(async () => {
    try {
      const { data } = await api.get('/profiles');
      setProfiles(data);
      return data;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles().then(async (data) => {
      const saved = await loadSavedProfile(data);
      if (saved) router.replace('/(tabs)');
    });
  }, []);

  function openCreate() {
    setEditing(null);
    setName('');
    setSelectedAvatar('avatar_1');
    setIsKids(false);
    setPin('');
    setAvatarTab('fotos');
    setModalVisible(true);
    fetchPresets(false);
  }

  function openEdit(profile) {
    setEditing(profile);
    setName(profile.name);
    setSelectedAvatar(profile.avatar);
    setIsKids(profile.is_kids);
    setPin(profile.has_pin ? '••••' : '');
    setAvatarTab(isUrl(profile.avatar) ? 'fotos' : 'emoji');
    setModalVisible(true);
    fetchPresets(profile.is_kids);
  }

  async function fetchPresets(kids) {
    try {
      const { data } = await api.get('/preset-avatars' + (kids ? '?kids=true' : ''));
      setPresetAvatars(data || []);
    } catch {
      setPresetAvatars([]);
    }
  }

  // Ao trocar o toggle kids, recarrega os presets
  function handleKidsToggle() {
    const next = !isKids;
    setIsKids(next);
    fetchPresets(next);
    if (next) setAvatarTab('fotos');
  }

  async function handleSave() {
    if (!name.trim()) return Alert.alert('Nome obrigatório', 'Preencha o nome do perfil.');
    if (pin && pin !== '••••' && !/^\d{4,6}$/.test(pin.trim())) {
      return Alert.alert('PIN inválido', 'O PIN deve ter de 4 a 6 números.');
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), avatar: selectedAvatar, is_kids: isKids };
      // "••••" é o placeholder de "já tem PIN, não mexi nele" — só manda o
      // campo quando o usuário de fato digitou algo novo ou apagou tudo.
      if (pin !== '••••') payload.pin = pin.trim() || null;
      if (editing) {
        await api.put(`/profiles/${editing.id}`, payload);
      } else {
        await api.post('/profiles', payload);
      }
      setModalVisible(false);
      fetchProfiles();
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(profile) {
    Alert.alert('Excluir perfil', `Excluir "${profile.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/profiles/${profile.id}`);
            fetchProfiles();
          } catch (e) {
            Alert.alert('Erro', e.response?.data?.error || 'Erro ao excluir');
          }
        },
      },
    ]);
  }

  async function handleSelect(profile) {
    if (profile.has_pin) {
      setPinPrompt(profile);
      setPinPromptValue('');
      setPinPromptError(false);
      return;
    }
    await selectProfile(profile);
    router.replace('/(tabs)');
  }

  async function confirmPinPrompt() {
    if (!pinPrompt) return;
    setPinChecking(true);
    try {
      const { data } = await api.post(`/profiles/${pinPrompt.id}/verify-pin`, { pin: pinPromptValue.trim() });
      if (data.ok) {
        const profile = pinPrompt;
        setPinPrompt(null);
        await selectProfile(profile);
        router.replace('/(tabs)');
      } else {
        setPinPromptError(true);
        setPinPromptValue('');
      }
    } catch {
      setPinPromptError(true);
    } finally {
      setPinChecking(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#E50914" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>FLIXHOME</Text>
        <Text style={styles.title}>Quem está assistindo?</Text>
        <Text style={styles.hint}>Segure um perfil para editar</Text>
      </View>

      <FlatList
        data={profiles}
        keyExtractor={p => p.id}
        numColumns={3}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <ProfileCard
            profile={item}
            onPress={() => handleSelect(item)}
            onLongPress={() => openEdit(item)}
          />
        )}
        ListFooterComponent={profiles.length < 5 ? (
          <TouchableOpacity style={styles.addCard} onPress={openCreate}>
            <View style={styles.addIcon}>
              <Ionicons name="add" size={32} color="#555" />
            </View>
            <Text style={styles.profileName}>Adicionar</Text>
          </TouchableOpacity>
        ) : null}
      />

      {/* ── Modal de criação/edição ── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {/* Handle bar */}
            <View style={styles.handle} />

            <Text style={styles.modalTitle}>{editing ? 'Editar perfil' : 'Novo perfil'}</Text>

            {/* Preview grande do avatar */}
            <View style={styles.previewWrap}>
              <AvatarCircle avatarId={selectedAvatar} size={96} />
              <View style={styles.previewEditBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </View>

            {/* Campo de nome */}
            <TextInput
              style={styles.nameInput}
              placeholder="Nome do perfil"
              placeholderTextColor="#444"
              value={name}
              onChangeText={setName}
              maxLength={20}
            />

            {/* Toggle infantil */}
            <TouchableOpacity style={styles.kidsToggle} onPress={handleKidsToggle} activeOpacity={0.7}>
              <View style={[styles.toggleTrack, isKids && styles.toggleTrackOn]}>
                <View style={[styles.toggleThumb, isKids && styles.toggleThumbOn]} />
              </View>
              <Text style={[styles.kidsLabel, isKids && { color: '#4caf50' }]}>
                Perfil infantil {isKids ? '👶' : ''}
              </Text>
            </TouchableOpacity>

            {/* PIN opcional (só faz sentido em perfil não-infantil) */}
            {!isKids && (
              <View style={{ alignSelf: 'stretch', marginBottom: 20 }}>
                <Text style={styles.pinLabel}>PIN de acesso (opcional)</Text>
                <TextInput
                  style={styles.pinInput}
                  placeholder="Deixe em branco pra não usar PIN"
                  placeholderTextColor="#444"
                  value={pin}
                  onChangeText={setPin}
                  onFocus={() => { if (pin === '••••') setPin(''); }}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                />
              </View>
            )}

            {/* Tabs fotos / emoji */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, avatarTab === 'fotos' && styles.tabActive]}
                onPress={() => setAvatarTab('fotos')}
              >
                <Text style={[styles.tabText, avatarTab === 'fotos' && styles.tabTextActive]}>Fotos</Text>
              </TouchableOpacity>
              {!isKids && (
                <TouchableOpacity
                  style={[styles.tab, avatarTab === 'emoji' && styles.tabActive]}
                  onPress={() => setAvatarTab('emoji')}
                >
                  <Text style={[styles.tabText, avatarTab === 'emoji' && styles.tabTextActive]}>Emojis</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Conteúdo do tab */}
            {avatarTab === 'fotos' ? (
              presetAvatars.length === 0 ? (
                <View style={styles.emptyAvatars}>
                  <Ionicons name="images-outline" size={32} color="#333" />
                  <Text style={styles.emptyAvatarsText}>
                    {isKids ? 'Nenhuma foto infantil disponível' : 'Nenhuma foto disponível ainda'}
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarRow} contentContainerStyle={{ paddingHorizontal: 4 }}>
                  {presetAvatars.map(av => {
                    const selected = selectedAvatar === av.url;
                    return (
                      <TouchableOpacity
                        key={av.id}
                        onPress={() => setSelectedAvatar(av.url)}
                        style={[styles.avatarOpt, selected && styles.avatarOptSelected]}
                        activeOpacity={0.75}
                      >
                        <CachedImage source={{ uri: av.url }} style={styles.avatarOptImg} />
                        {selected && (
                          <View style={styles.selectedBadge}>
                            <Ionicons name="checkmark" size={12} color="#fff" />
                          </View>
                        )}
                        {av.label ? <Text style={styles.avatarOptLabel} numberOfLines={1}>{av.label}</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarRow} contentContainerStyle={{ paddingHorizontal: 4 }}>
                {AVATARS.map(av => {
                  const selected = selectedAvatar === av.id;
                  return (
                    <TouchableOpacity
                      key={av.id}
                      onPress={() => setSelectedAvatar(av.id)}
                      style={[styles.avatarOpt, selected && styles.avatarOptSelected]}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.emojiCircle, { width: 62, height: 62, borderRadius: 31, backgroundColor: av.color }]}>
                        <Text style={{ fontSize: 28 }}>{av.emoji}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Botões */}
            <View style={styles.actions}>
              {editing && (
                <TouchableOpacity
                  style={styles.btnDelete}
                  onPress={() => { setModalVisible(false); handleDelete(editing); }}
                >
                  <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnSaveText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal de PIN pra abrir perfil protegido ── */}
      <Modal visible={!!pinPrompt} transparent animationType="fade" onRequestClose={() => setPinPrompt(null)}>
        <View style={styles.pinOverlay}>
          <View style={styles.pinBox}>
            <Text style={styles.pinTitle}>Perfil protegido</Text>
            <Text style={styles.pinSub}>Digite o PIN de "{pinPrompt?.name}" para continuar</Text>
            <TextInput
              style={[styles.pinPromptInput, pinPromptError && styles.pinPromptInputError]}
              value={pinPromptValue}
              onChangeText={v => { setPinPromptValue(v); setPinPromptError(false); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="••••"
              placeholderTextColor="#444"
              autoFocus
              onSubmitEditing={confirmPinPrompt}
            />
            {pinPromptError && <Text style={styles.pinPromptError}>PIN incorreto. Tente novamente.</Text>}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setPinPrompt(null)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={confirmPinPrompt} disabled={pinChecking}>
                {pinChecking
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnSaveText}>Confirmar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingTop: 64, paddingBottom: 24, alignItems: 'center' },
  logo: { fontSize: 26, fontWeight: '900', color: '#E50914', letterSpacing: 5, marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 6 },
  hint: { color: '#333', fontSize: 12 },

  grid: { paddingHorizontal: 12, paddingBottom: 32 },
  profileCard: { width: 110, alignItems: 'center', marginBottom: 28, marginHorizontal: 4 },
  profileAvatarWrap: { position: 'relative' },
  kidsOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#0a0a0a',
  },
  profileName: { color: '#ccc', fontSize: 13, marginTop: 10, textAlign: 'center', fontWeight: '500' },
  kidsTag: { fontSize: 10, color: '#4caf50', fontWeight: '700', marginTop: 2 },

  addCard: { width: 110, alignItems: 'center', marginBottom: 28, marginHorizontal: 4 },
  addIcon: {
    width: 82, height: 82, borderRadius: 41,
    backgroundColor: '#111', borderWidth: 2, borderColor: '#2a2a2a',
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center',
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#141414', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#2a2a2a', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 20 },

  previewWrap: { position: 'relative', marginBottom: 20 },
  previewEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#E50914', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#141414',
  },

  nameInput: {
    width: '100%', backgroundColor: '#1e1e1e', color: '#fff',
    padding: 14, borderRadius: 12, fontSize: 16,
    borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 14,
    textAlign: 'center', fontWeight: '600',
  },

  kidsToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start', marginBottom: 20 },
  toggleTrack: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#2a2a2a', justifyContent: 'center', paddingHorizontal: 3 },
  toggleTrackOn: { backgroundColor: '#4caf50' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: 'flex-start' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  kidsLabel: { color: '#666', fontSize: 14 },

  tabs: { flexDirection: 'row', backgroundColor: '#1a1a1a', borderRadius: 10, padding: 3, marginBottom: 16, alignSelf: 'stretch' },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#2a2a2a' },
  tabText: { color: '#555', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  avatarRow: { alignSelf: 'stretch', marginBottom: 20, maxHeight: 110 },
  avatarOpt: {
    alignItems: 'center', marginHorizontal: 6, padding: 4,
    borderRadius: 14, borderWidth: 2, borderColor: 'transparent',
  },
  avatarOptSelected: { borderColor: '#E50914' },
  avatarOptImg: { width: 62, height: 62, borderRadius: 31 },
  selectedBadge: {
    position: 'absolute', top: 2, right: 2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#E50914', justifyContent: 'center', alignItems: 'center',
  },
  avatarOptLabel: { color: '#666', fontSize: 10, marginTop: 4, maxWidth: 62, textAlign: 'center' },

  emptyAvatars: { alignItems: 'center', gap: 8, paddingVertical: 20, marginBottom: 20 },
  emptyAvatarsText: { color: '#333', fontSize: 13 },

  emojiCircle: { justifyContent: 'center', alignItems: 'center' },

  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  btnDelete: {
    width: 48, height: 48, borderRadius: 12,
    borderWidth: 1, borderColor: '#ff6b6b22',
    justifyContent: 'center', alignItems: 'center',
  },
  btnCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center',
  },
  btnCancelText: { color: '#666', fontWeight: '600', fontSize: 15 },
  btnSave: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#E50914', alignItems: 'center',
  },
  btnSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  pinLabel: { color: '#666', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  pinInput: {
    backgroundColor: '#1e1e1e', color: '#fff', padding: 14, borderRadius: 12,
    fontSize: 16, borderWidth: 1, borderColor: '#2a2a2a', textAlign: 'center', letterSpacing: 4,
  },

  pinOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  pinBox: { backgroundColor: '#141414', borderRadius: 20, padding: 28, width: '100%', maxWidth: 340, alignItems: 'center' },
  pinTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  pinSub: { color: '#aaa', fontSize: 13, textAlign: 'center', marginBottom: 20 },
  pinPromptInput: {
    width: '100%', backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 10, padding: 14, color: '#fff', fontSize: 20, textAlign: 'center',
    letterSpacing: 8, marginBottom: 6,
  },
  pinPromptInputError: { borderColor: '#E50914' },
  pinPromptError: { color: '#E50914', fontSize: 12, marginBottom: 10 },
});
