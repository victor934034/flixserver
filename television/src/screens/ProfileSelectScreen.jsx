import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, FlatList,
  Modal, TextInput, ScrollView, ActivityIndicator, Dimensions, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useProfile, AVATARS, getAvatar } from '../contexts/ProfileContext';
import api from '../lib/api';

const { width: W, height: H } = Dimensions.get('window');
const S = Math.min(W / 1920, H / 1080);
const r = v => Math.max(1, Math.round(v * S));
const ACCENT = '#c91c2c';

const isUrl = s => typeof s === 'string' && s.startsWith('http');

function TVPressable({ children, style, onPress, onFocus, onBlur, hasTVPreferredFocus }) {
  return (
    <Pressable
      focusable
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

function AvatarCircle({ avatar, size }) {
  if (isUrl(avatar)) {
    return <Image source={{ uri: avatar }} style={{ width: size, height: size, borderRadius: size * 0.22 }} />;
  }
  const av = getAvatar(avatar);
  return (
    <View style={{
      width: size, height: size, borderRadius: size * 0.22, backgroundColor: av.color,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.44 }}>{av.emoji}</Text>
    </View>
  );
}

function ProfileCard({ profile, editMode, onPress, grabFocus }) {
  const [foc, setFoc] = useState(false);
  return (
    <TVPressable
      hasTVPreferredFocus={grabFocus}
      onFocus={() => setFoc(true)}
      onBlur={() => setFoc(false)}
      onPress={onPress}
      style={[s.card, foc && s.cardFoc]}
    >
      <View>
        <AvatarCircle avatar={profile.avatar} size={r(140)} />
        {profile.is_kids && (
          <View style={s.kidsBadge}><Text style={{ fontSize: r(16) }}>👶</Text></View>
        )}
        {editMode && (
          <View style={s.editBadge}><Ionicons name="pencil" size={r(18)} color="#fff" /></View>
        )}
      </View>
      <Text style={[s.cardName, foc && s.cardNameFoc]} numberOfLines={1}>{profile.name}</Text>
    </TVPressable>
  );
}

function CreateProfileModal({ editing, onDone, onCancel, onDelete }) {
  const [name, setName] = useState(editing ? editing.name : '');
  const [avatarId, setAvatarId] = useState(editing ? editing.avatar : 'avatar_1');
  const [isKids, setIsKids] = useState(editing ? !!editing.is_kids : false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim()) { setError('Digite um nome'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.put(`/profiles/${editing.id}`, { name: name.trim(), avatar: avatarId, is_kids: isKids });
      } else {
        await api.post('/profiles', { name: name.trim(), avatar: avatarId, is_kids: isKids });
      }
      onDone();
    } catch (e) {
      setError(e.response?.data?.error || 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Excluir perfil', `Excluir "${editing.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => onDelete(editing) },
    ]);
  }

  return (
    <Modal visible transparent animationType="fade">
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <Text style={s.modalTitle}>{editing ? 'Editar perfil' : 'Novo perfil'}</Text>
          {!!error && <Text style={s.modalError}>{error}</Text>}

          <View style={{ alignItems: 'center', marginBottom: r(24) }}>
            <AvatarCircle avatar={avatarId} size={r(120)} />
          </View>

          <TextInput
            value={name}
            onChangeText={t => { setName(t); setError(''); }}
            placeholder="Nome do perfil"
            placeholderTextColor="#555"
            style={s.modalInput}
            maxLength={20}
          />

          <TVPressable
            onPress={() => setIsKids(k => !k)}
            style={[s.kidsToggle, isKids && s.kidsToggleOn]}
          >
            <Text style={s.kidsToggleTxt}>{isKids ? '👶 Perfil infantil (ativado)' : 'Marcar como perfil infantil'}</Text>
          </TVPressable>

          <Text style={s.avatarLabel}>Avatar</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: r(28) }}>
            {AVATARS.map(av => (
              <TVPressable
                key={av.id}
                onPress={() => setAvatarId(av.id)}
                style={[s.avatarOpt, avatarId === av.id && s.avatarOptSel]}
              >
                <View style={{ width: r(64), height: r(64), borderRadius: r(32), backgroundColor: av.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: r(30) }}>{av.emoji}</Text>
                </View>
              </TVPressable>
            ))}
          </ScrollView>

          <View style={s.modalActions}>
            {editing && (
              <TVPressable onPress={confirmDelete} style={s.btnDelete}>
                <Text style={s.btnDeleteTxt}>Excluir</Text>
              </TVPressable>
            )}
            <View style={{ flex: 1 }} />
            <TVPressable onPress={onCancel} style={s.btnCancel}>
              <Text style={s.btnCancelTxt}>Cancelar</Text>
            </TVPressable>
            <TVPressable onPress={handleSave} hasTVPreferredFocus style={s.btnSave}>
              <Text style={s.btnSaveTxt}>{saving ? 'Salvando...' : 'Salvar'}</Text>
            </TVPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileSelectScreen({ navigation }) {
  const { user } = useAuth();
  const { selectProfile, loadSavedProfile } = useProfile();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editing, setEditing] = useState(null); // {} = criando, {...} = editando

  const fetchProfiles = async () => {
    try {
      const { data } = await api.get('/profiles');
      setProfiles(data || []);
      return data || [];
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles().then(async data => {
      const saved = await loadSavedProfile(data);
      if (saved) navigation.replace('Home');
    });
  }, []);

  async function handleSelect(profile) {
    if (editMode) { setEditing(profile); return; }
    await selectProfile(profile);
    navigation.replace('Home');
  }

  async function handleDelete(profile) {
    try {
      await api.delete(`/profiles/${profile.id}`);
      setEditing(null);
      fetchProfiles();
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Não foi possível excluir');
    }
  }

  if (loading) {
    return <View style={[s.container, s.center]}><ActivityIndicator color={ACCENT} size="large" /></View>;
  }

  return (
    <View style={s.container}>
      <Text style={s.logo}>FLIXHOME</Text>
      <Text style={s.title}>Quem está assistindo?</Text>
      <Text style={s.hint}>{editMode ? 'Selecione um perfil para editar' : 'Pressione OPÇÕES ou selecione "Editar" para gerenciar perfis'}</Text>

      <FlatList
        data={profiles}
        keyExtractor={p => p.id}
        horizontal
        contentContainerStyle={s.grid}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <ProfileCard
            profile={item}
            editMode={editMode}
            grabFocus={index === 0}
            onPress={() => handleSelect(item)}
          />
        )}
        ListFooterComponent={
          profiles.length < 5 ? (
            <TVPressable onPress={() => setEditing({})} style={s.addCard}>
              <View style={s.addIcon}><Ionicons name="add" size={r(48)} color="#666" /></View>
              <Text style={s.cardName}>Adicionar</Text>
            </TVPressable>
          ) : null
        }
      />

      <TVPressable onPress={() => setEditMode(m => !m)} style={[s.editToggle, editMode && s.editToggleOn]}>
        <Ionicons name="pencil" size={r(18)} color="#fff" />
        <Text style={s.editToggleTxt}>{editMode ? 'Concluir edição' : 'Editar perfis'}</Text>
      </TVPressable>

      {editing !== null && (
        <CreateProfileModal
          editing={editing.id ? editing : null}
          onDone={() => { setEditing(null); fetchProfiles(); }}
          onCancel={() => setEditing(null)}
          onDelete={handleDelete}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', paddingVertical: r(40) },
  center: { alignItems: 'center', justifyContent: 'center' },
  logo: { color: ACCENT, fontSize: r(28), fontWeight: '900', letterSpacing: 3, marginBottom: r(24) },
  title: { color: '#fff', fontSize: r(34), fontWeight: '800', marginBottom: r(10) },
  hint: { color: '#666', fontSize: r(15), marginBottom: r(40) },
  grid: { gap: r(28), paddingHorizontal: r(20), alignItems: 'flex-start' },
  card: { alignItems: 'center', gap: r(12), padding: r(8), borderRadius: r(16) },
  cardFoc: { transform: [{ scale: 1.08 }] },
  cardName: { color: '#999', fontSize: r(16), fontWeight: '600' },
  cardNameFoc: { color: '#fff' },
  kidsBadge: {
    position: 'absolute', bottom: -4, right: -4, backgroundColor: '#111',
    borderRadius: r(14), width: r(28), height: r(28), alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0a0a0a',
  },
  editBadge: {
    position: 'absolute', top: r(-6), right: r(-6), backgroundColor: ACCENT,
    borderRadius: r(14), width: r(28), height: r(28), alignItems: 'center', justifyContent: 'center',
  },
  addCard: { alignItems: 'center', gap: r(12), padding: r(8) },
  addIcon: {
    width: r(140), height: r(140), borderRadius: r(30), borderWidth: 2, borderColor: '#333',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
  },
  editToggle: {
    flexDirection: 'row', alignItems: 'center', gap: r(8), marginTop: r(48),
    paddingHorizontal: r(20), paddingVertical: r(12), borderRadius: r(24),
    borderWidth: 1, borderColor: '#333',
  },
  editToggleOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  editToggleTxt: { color: '#fff', fontSize: r(14), fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { backgroundColor: '#141414', borderRadius: r(20), padding: r(48), width: r(720) },
  modalTitle: { color: '#fff', fontSize: r(24), fontWeight: '800', marginBottom: r(20), textAlign: 'center' },
  modalError: { color: ACCENT, fontSize: r(14), textAlign: 'center', marginBottom: r(12) },
  modalInput: {
    backgroundColor: '#1e1e1e', borderRadius: r(10), borderWidth: 1, borderColor: '#2a2a2a',
    color: '#fff', fontSize: r(18), padding: r(16), marginBottom: r(18),
  },
  kidsToggle: {
    borderRadius: r(10), borderWidth: 1, borderColor: '#2a2a2a', padding: r(14),
    marginBottom: r(24), alignItems: 'center',
  },
  kidsToggleOn: { backgroundColor: 'rgba(76,175,80,0.15)', borderColor: '#4caf50' },
  kidsToggleTxt: { color: '#ccc', fontSize: r(14), fontWeight: '600' },
  avatarLabel: { color: '#666', fontSize: r(12), fontWeight: '700', letterSpacing: 1, marginBottom: r(12), textTransform: 'uppercase' },
  avatarOpt: { marginRight: r(14), borderRadius: r(36), borderWidth: 3, borderColor: 'transparent', padding: 2 },
  avatarOptSel: { borderColor: ACCENT },
  modalActions: { flexDirection: 'row', alignItems: 'center', marginTop: r(10), gap: r(12) },
  btnDelete: { paddingHorizontal: r(18), paddingVertical: r(12), borderRadius: r(8), borderWidth: 1, borderColor: 'rgba(229,9,20,0.4)' },
  btnDeleteTxt: { color: '#ff6b6b', fontSize: r(14), fontWeight: '700' },
  btnCancel: { paddingHorizontal: r(20), paddingVertical: r(12), borderRadius: r(8), borderWidth: 1, borderColor: '#2a2a2a' },
  btnCancelTxt: { color: '#aaa', fontSize: r(14), fontWeight: '700' },
  btnSave: { paddingHorizontal: r(24), paddingVertical: r(12), borderRadius: r(8), backgroundColor: ACCENT },
  btnSaveTxt: { color: '#fff', fontSize: r(14), fontWeight: '700' },
});
