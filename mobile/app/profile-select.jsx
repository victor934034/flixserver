import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Modal, TextInput, ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useProfile, AVATARS, getAvatar } from '../contexts/ProfileContext';
import api from '../lib/api';

const isUrl = (s) => typeof s === 'string' && s.startsWith('http');

function AvatarCircle({ avatarId, size = 72 }) {
  if (isUrl(avatarId)) {
    return (
      <Image
        source={{ uri: avatarId }}
        style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }
  const av = getAvatar(avatarId);
  return (
    <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: av.color }]}>
      <Text style={{ fontSize: size * 0.45 }}>{av.emoji}</Text>
    </View>
  );
}

function ProfileCard({ profile, onPress, onLongPress }) {
  return (
    <TouchableOpacity style={styles.profileCard} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.75}>
      <AvatarCircle avatarId={profile.avatar} size={80} />
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
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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
    setModalVisible(true);
  }

  function openEdit(profile) {
    setEditing(profile);
    setName(profile.name);
    setSelectedAvatar(profile.avatar);
    setIsKids(profile.is_kids);
    setModalVisible(true);
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Permita o acesso à galeria para adicionar uma foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      const filename = asset.uri.split('/').pop();
      const ext = filename.split('.').pop().toLowerCase();
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      form.append('file', { uri: asset.uri, name: filename, type: mime });

      const { data } = await api.post('/upload/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSelectedAvatar(data.cdnUrl);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível enviar a foto. Tente novamente.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) return Alert.alert('Preencha o nome do perfil');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/profiles/${editing.id}`, { name: name.trim(), avatar: selectedAvatar, is_kids: isKids });
      } else {
        await api.post('/profiles', { name: name.trim(), avatar: selectedAvatar, is_kids: isKids });
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
    await selectProfile(profile);
    router.replace('/(tabs)');
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
      <Text style={styles.logo}>FLIXHOME</Text>
      <Text style={styles.title}>Quem está assistindo?</Text>

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
            <View style={styles.addIcon}><Text style={styles.addPlus}>+</Text></View>
            <Text style={styles.profileName}>Adicionar</Text>
          </TouchableOpacity>
        ) : null}
      />

      <Text style={styles.hint}>Segure um perfil para editar ou excluir</Text>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editing ? 'Editar perfil' : 'Novo perfil'}</Text>

            {/* Preview do avatar selecionado */}
            <View style={styles.avatarPreviewWrap}>
              <AvatarCircle avatarId={selectedAvatar} size={80} />
              {uploadingPhoto && (
                <View style={styles.avatarUploading}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              )}
            </View>

            {/* Botão de foto + scroll de avatares */}
            <View style={styles.avatarRowWrap}>
              <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto} disabled={uploadingPhoto}>
                <Text style={styles.photoBtnText}>{uploadingPhoto ? '...' : '📷'}</Text>
                <Text style={styles.photoBtnLabel}>Foto</Text>
              </TouchableOpacity>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarScroll}>
                {AVATARS.map(av => (
                  <TouchableOpacity key={av.id} onPress={() => setSelectedAvatar(av.id)}
                    style={[styles.avatarOption, selectedAvatar === av.id && styles.avatarOptionSelected]}>
                    <View style={[styles.avatarCircle, { width: 48, height: 48, borderRadius: 24, backgroundColor: av.color }]}>
                      <Text style={{ fontSize: 22 }}>{av.emoji}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TextInput
              style={styles.modalInput} placeholder="Nome do perfil" placeholderTextColor="#666"
              value={name} onChangeText={setName} maxLength={20}
            />

            <TouchableOpacity style={styles.kidsToggle} onPress={() => setIsKids(v => !v)}>
              <View style={[styles.kidsBox, isKids && styles.kidsBoxOn]} />
              <Text style={styles.kidsLabel}>Perfil infantil</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              {editing && (
                <TouchableOpacity style={styles.btnDelete} onPress={() => { setModalVisible(false); handleDelete(editing); }}>
                  <Text style={styles.btnDeleteText}>Excluir</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnSaveText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 60 },
  logo: { fontSize: 28, fontWeight: '900', color: '#E50914', textAlign: 'center', letterSpacing: 4, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 32 },
  grid: { paddingHorizontal: 16, alignItems: 'flex-start' },
  profileCard: { width: 110, alignItems: 'center', marginBottom: 24, marginHorizontal: 4 },
  addCard: { width: 110, alignItems: 'center', marginBottom: 24, marginHorizontal: 4 },
  avatarCircle: { justifyContent: 'center', alignItems: 'center' },
  addIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#444', borderStyle: 'dashed' },
  addPlus: { fontSize: 36, color: '#888' },
  profileName: { color: '#ccc', fontSize: 13, marginTop: 8, textAlign: 'center' },
  kidsTag: { fontSize: 10, color: '#E50914', fontWeight: '700', marginTop: 2 },
  hint: { color: '#444', fontSize: 12, textAlign: 'center', marginBottom: 24 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#141414', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 16 },
  avatarPreviewWrap: { position: 'relative', marginBottom: 12 },
  avatarUploading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  avatarRowWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  photoBtn: { alignItems: 'center', marginRight: 8, padding: 6, backgroundColor: '#2a2a2a', borderRadius: 10, borderWidth: 1, borderColor: '#444', minWidth: 52 },
  photoBtnText: { fontSize: 22 },
  photoBtnLabel: { fontSize: 10, color: '#aaa', marginTop: 2 },
  avatarScroll: { marginVertical: 8 },
  avatarOption: { padding: 4, marginHorizontal: 4, borderRadius: 28, borderWidth: 2, borderColor: 'transparent' },
  avatarOptionSelected: { borderColor: '#E50914' },
  modalInput: { width: '100%', backgroundColor: '#1f1f1f', color: '#fff', padding: 14, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: '#333', marginBottom: 12 },
  kidsToggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 20 },
  kidsBox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#555', marginRight: 10 },
  kidsBoxOn: { backgroundColor: '#E50914', borderColor: '#E50914' },
  kidsLabel: { color: '#ccc', fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 10, width: '100%' },
  btnDelete: { flex: 1, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#ff6b6b', alignItems: 'center' },
  btnDeleteText: { color: '#ff6b6b', fontWeight: '600' },
  btnCancel: { flex: 1, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#444', alignItems: 'center' },
  btnCancelText: { color: '#888', fontWeight: '600' },
  btnSave: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#E50914', alignItems: 'center' },
  btnSaveText: { color: '#fff', fontWeight: '700' },
});
