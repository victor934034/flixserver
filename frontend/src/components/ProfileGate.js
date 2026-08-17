'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import api from '../lib/api';
import { getToken } from '../lib/auth';
import { useProfile } from '../contexts/ProfileContext';

const EXEMPT_PREFIXES = ['/login', '/perfis', '/politica-de-privacidade', '/admin'];

// Reflete o gate do app mobile: usuário logado sem perfil ativo é sempre
// levado pra tela de seleção — sem isso, histórico/lista ficam sem dono.
export default function ProfileGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeProfile, loadSavedProfile } = useProfile();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current || activeProfile) return;
    if (!getToken()) return;
    if (EXEMPT_PREFIXES.some(p => pathname.startsWith(p))) return;

    checkedRef.current = true;
    api.get('/profiles')
      .then(r => {
        const saved = loadSavedProfile(r.data || []);
        if (!saved) router.replace('/perfis');
      })
      .catch(() => {});
  }, [pathname, activeProfile, loadSavedProfile, router]);

  return null;
}
