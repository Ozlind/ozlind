import './globals.css';

export const metadata = {
  title: 'OZLIND AI',
  description: 'OZLIND AI — a focused private AI workspace for chat, research and creation.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
