export const metadata = {
  title: 'Flixhome TV',
};

export default function TVLayout({ children }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      overflow: 'hidden',
      background: '#000',
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    }}>
      {children}
    </div>
  );
}
