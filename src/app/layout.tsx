import type { Metadata, Viewport } from "next";
import "../styles/theme.css";
import "../styles/globals.css";
import "../styles/sidebar-polish.css";
import "../styles/unified-design-system.css";
import { QueryProvider } from "@/providers/QueryProvider";
import PostHogAnalytics from "@/components/analytics/PostHogAnalytics";

export const metadata: Metadata = {
  metadataBase: new URL("https://ozlind.vercel.app"),
  title: {
    default: "Ozlind — A calmer AI workspace",
    template: "%s | Ozlind",
  },
  description: "A focused AI workspace for thoughtful conversations, useful documents, and work worth keeping.",
  applicationName: "Ozlind",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "Ozlind",
    title: "Ozlind — A calmer AI workspace",
    description: "A focused AI workspace for thoughtful conversations, useful documents, and work worth keeping.",
    url: "https://ozlind.vercel.app",
  },
  twitter: {
    card: "summary",
    title: "Ozlind — A calmer AI workspace",
    description: "A focused AI workspace for thoughtful conversations, useful documents, and work worth keeping.",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: "#0d0d0f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryProvider>
          <PostHogAnalytics />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
