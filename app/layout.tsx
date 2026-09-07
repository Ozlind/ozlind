import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OZLIND — Your All-in-One AI Companion",
  description:
    "A premium all-in-one AI workspace for chat, coding, creativity and productivity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
