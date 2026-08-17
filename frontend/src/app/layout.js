import './globals.css';
import Providers from '../components/Providers';

export const metadata = {
  title: 'Flixhome',
  description: 'Sua plataforma de streaming',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
