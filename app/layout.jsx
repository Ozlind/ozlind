import "./globals.css";

export const metadata = {
  title: "OZLIND AI",
  description: "A focused AI workspace for conversation, research and creation.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080a10",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
