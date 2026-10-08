import "./globals.css";
import "./tokens.css";
import "./premium.css";
import "./neutral.css";
import "./ozlind-v2.css";
import "./ozlind-v3.css";

export const metadata = {
  title: "OZLIND AI",
  description:
    "OZLIND AI — an intelligent workspace for chat, research, writing and planning.",
  applicationName: "OZLIND AI",
  authors: [{ name: "OZLIND" }],
  icons: { icon: "/ozlind-mark.svg", shortcut: "/ozlind-mark.svg", apple: "/ozlind-mark.svg" },
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111315",
  colorScheme: "light dark",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
