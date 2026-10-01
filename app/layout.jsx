import "./globals.css";
import "./tokens.css";

export const metadata = {
  title: "OZLIND AI",
  description:
    "OZLIND AI — an intelligent workspace for chat, research, writing and planning.",
  applicationName: "OZLIND AI",
  authors: [{ name: "OZLIND" }],
  icons: {
    icon: "/ozlind-icons.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0B0C0E",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}