import type { Metadata, Viewport } from "next";
import "../styles/theme.css";
import "../styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ozlind.vercel.app"),
  title: { default: "Ozlind", template: "%s | Ozlind" },
  description: "A focused AI workspace for thoughtful conversations and useful work.",
  applicationName: "Ozlind",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
