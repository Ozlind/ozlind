import './globals.css';

export const metadata = {
  title: 'OZLIND AI',
  description: 'A focused AI workspace for conversation, research, reasoning and file understanding.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#090A0D',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
