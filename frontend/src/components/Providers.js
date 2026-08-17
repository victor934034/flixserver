'use client';
import { ProfileProvider } from '../contexts/ProfileContext';
import { ParentalProvider } from '../contexts/ParentalContext';
import ProfileGate from './ProfileGate';

export default function Providers({ children }) {
  return (
    <ProfileProvider>
      <ParentalProvider>
        <ProfileGate />
        {children}
      </ParentalProvider>
    </ProfileProvider>
  );
}
