import "./globals.css";
import "./tokens.css";
import "./premium.css";

export const metadata = {
  title: "OZLIND AI",
  description:
    "OZLIND AI — an intelligent workspace for chat, research, writing and planning.",
  applicationName: "OZLIND AI",
  authors: [{ name: "OZLIND" }],
  icons: { icon: "/ozlind-icons.svg" },
  robots: { index: false, follow: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#E26F4A",
  colorScheme: "light dark",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
