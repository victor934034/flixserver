'use client';
import { ProfileProvider } from '../contexts/ProfileContext';
import { ParentalProvider } from '../contexts/ParentalContext';
import ProfileGate from './ProfileGate';
import BrowserNotice from './BrowserNotice';
import WhatsNew from './WhatsNew';
import ArrivedNotice from './ArrivedNotice';
import TutorialHost from './TutorialHost';

export default function Providers({ children }) {
  return (
    <ProfileProvider>
      <ParentalProvider>
        <ProfileGate />
        {children}
        <BrowserNotice />
        <TutorialHost>
          <ArrivedNotice />
          <WhatsNew />
        </TutorialHost>
      </ParentalProvider>
    </ProfileProvider>
  );
}
