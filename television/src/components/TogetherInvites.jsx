import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, Image } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { joinTogether } from '../lib/together';

const { width: W, height: H } = Dimensions.get('window');
const S = Math.min(W / 1920, H / 1080);
const r = v => Math.max(1, Math.round(v * S));

// Convites do "Assistir juntos": consulta a cada 15s e mostra um aviso com Entrar / Agora não.
export default function TogetherInvites({ navigationRef }) {
  const { user } = useAuth();
  const [invite, setInvite] = useState(null);
  const [busy, setBusy] = useState(false);
  const [foc, setFoc] = useState('join');
  const [dismissed] = useState(() => new Set());

  useEffect(() => {
    if (!user) { setInvite(null); return; }
    let alive = true;
    const check = async () => {
      try {
        const { data } = await api.get('/together/invites');
        const next = (data || []).find(i => !dismissed.has(i.code));
        if (alive) setInvite(prev => prev || next || null);
      } catch {}
    };
    check();
    const t = setInterval(check, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [user]);

  if (!invite) return null;

  const decline = async () => {
    dismissed.add(invite.code);
    api.delete(`/together/invites/${invite.code}`).catch(() => {});
    setInvite(null);
  };
  const join = async () => {
    setBusy(true);
    try {
      await joinTogether(navigationRef.current, invite.code);
      dismissed.add(invite.code);
      setInvite(null);
    } catch { decline(); }
    setBusy(false);
  };

  return (
    <View style={s.overlay}>
      <View style={s.card}>
        {invite.poster_url ? <Image source={{ uri: invite.poster_url }} style={s.poster} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>ASSISTIR JUNTOS</Text>
          <Text style={s.title}>{invite.from} chamou você</Text>
          <Text style={s.sub}>{invite.title}</Text>
          <View style={s.row}>
            <Pressable focusable hasTVPreferredFocus onFocus={() => setFoc('join')} onPress={join} style={[s.btn, s.btnRed, foc === 'join' && s.btnFoc]}>
              <Text style={s.btnTxt}>{busy ? 'Entrando…' : 'Entrar'}</Text>
            </Pressable>
            <Pressable focusable onFocus={() => setFoc('no')} onPress={decline} style={[s.btn, foc === 'no' && s.btnFoc]}>
              <Text style={s.btnTxt}>Agora não</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  card: { flexDirection: 'row', gap: r(28), width: r(980), padding: r(32), borderRadius: r(20), backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a' },
  poster: { width: r(180), height: r(270), borderRadius: r(10) },
  kicker: { color: '#E50914', fontSize: r(14), fontWeight: '800', letterSpacing: 2 },
  title: { color: '#fff', fontSize: r(34), fontWeight: '900', marginTop: r(8) },
  sub: { color: '#A3A3A3', fontSize: r(22), marginTop: r(6) },
  row: { flexDirection: 'row', gap: r(16), marginTop: r(28) },
  btn: { paddingHorizontal: r(36), paddingVertical: r(16), borderRadius: r(12), backgroundColor: '#1F1F1F', borderWidth: 3, borderColor: 'transparent' },
  btnRed: { backgroundColor: '#E50914' },
  btnFoc: { borderColor: '#fff', transform: [{ scale: 1.06 }] },
  btnTxt: { color: '#fff', fontSize: r(20), fontWeight: '800' },
});
