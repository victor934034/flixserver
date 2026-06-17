import './globals.css';

export const metadata = {
  title: 'Flixhome',
  description: 'Sua plataforma de streaming',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
