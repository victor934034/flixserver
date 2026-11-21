import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Linking, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const PRESETS = [5, 10, 20, 50];

export default function SupportBanner() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState('10');

  function handleDonate() {
    const value = Number(String(amount).replace(',', '.'));
    if (!value || value < 5) {
      Alert.alert('Valor mínimo', 'O apoio mínimo é de R$ 5,00.');
      return;
    }
    setModalOpen(false);
    router.push({ pathname: '/checkout', params: { kind: 'donate', amount: String(value) } });
  }

  return (
    <>
      <TouchableOpacity activeOpacity={0.9} onPress={() => setModalOpen(true)} style={styles.wrap}>
        <LinearGradient colors={['#3a0d1f', '#7a1230', '#c91c2c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <View style={styles.iconCircle}><Ionicons name="heart" size={22} color="#fff" /></View>
          <View style={styles.textWrap}>
            <Text style={styles.title}>Ajude a manter o FlixHome no ar</Text>
            <Text style={styles.desc}>Os servidores e o banco de dados custam caro e o valor sobe todo mês. Qualquer apoio, a partir de R$ 5, ajuda muito.</Text>
          </View>
          <View style={styles.btn}><Ionicons name="heart-outline" size={15} color="#c91c2c" /><Text style={styles.btnText}>Apoiar</Text></View>
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}><Ionicons name="heart" size={26} color="#c91c2c" /></View>
            <Text style={styles.modalTitle}>Apoie o FlixHome</Text>
            <Text style={styles.modalDesc}>
              Manter o app no ar custa hoje cerca de <Text style={{ color: '#fff', fontWeight: '800' }}>R$ 300 por mês</Text> e deve passar de <Text style={{ color: '#fff', fontWeight: '800' }}>R$ 400</Text> no próximo, por causa do banco de dados, que só cresce. Cada apoio ajuda a manter tudo funcionando. Obrigado! 💛
            </Text>
            <View style={styles.presets}>
              {PRESETS.map(v => (
                <TouchableOpacity key={v} style={[styles.preset, Number(amount) === v && styles.presetOn]} onPress={() => setAmount(String(v))}>
                  <Text style={[styles.presetTxt, Number(amount) === v && { color: '#111' }]}>R$ {v}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.currency}>R$</Text>
              <TextInput style={styles.input} placeholder="Outro valor" placeholderTextColor="#555" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
            </View>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleDonate}>
              <Text style={styles.confirmBtnText}>Apoiar com PIX ou cartão</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
              <Text style={styles.cancelBtnText}>Agora não</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 6, marginBottom: 18, borderRadius: 14, overflow: 'hidden' },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, gap: 12,
  },
  iconCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  textWrap: { flex: 1 },
  title: { color: '#fff', fontSize: 14, fontWeight: '800', marginBottom: 3 },
  desc: { color: 'rgba(255,255,255,0.85)', fontSize: 11.5, lineHeight: 15 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
  },
  btnText: { color: '#c91c2c', fontSize: 12.5, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 380, backgroundColor: '#161616', borderRadius: 18, padding: 24, alignItems: 'center' },
  modalIconCircle: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(201,28,44,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  modalTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 8 },
  modalDesc: { color: '#999', fontSize: 12.5, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    backgroundColor: '#0d0d0d', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: 14, marginBottom: 18,
  },
  currency: { color: '#666', fontSize: 15, fontWeight: '700', marginRight: 6 },
  input: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', paddingVertical: 12 },
  confirmBtn: {
    width: '100%', backgroundColor: '#c91c2c', borderRadius: 10,
    paddingVertical: 13, alignItems: 'center', marginBottom: 10,
  },
  confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  presets: { flexDirection: 'row', gap: 8, marginBottom: 14, width: '100%' },
  preset: { flex: 1, height: 42, borderRadius: 999, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  presetOn: { backgroundColor: '#E5E5E5', borderColor: '#E5E5E5' },
  presetTxt: { color: '#E5E5E5', fontWeight: '800', fontSize: 14 },
  cancelBtn: { paddingVertical: 6 },
  cancelBtnText: { color: '#888', fontSize: 13 },
});
