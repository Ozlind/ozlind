import "./globals.css";

export const metadata = {
  title: "OZLIND AI",
  description: "OZLIND AI — intelligent chat, research and creation platform.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
