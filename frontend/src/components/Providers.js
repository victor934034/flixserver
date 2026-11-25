'use client';
import { ProfileProvider } from '../contexts/ProfileContext';
import { ParentalProvider } from '../contexts/ParentalContext';
import ProfileGate from './ProfileGate';
import BrowserNotice from './BrowserNotice';
import WhatsNew from './WhatsNew';

export default function Providers({ children }) {
  return (
    <ProfileProvider>
      <ParentalProvider>
        <ProfileGate />
        {children}
        <BrowserNotice />
        <WhatsNew />
      </ParentalProvider>
    </ProfileProvider>
  );
}
