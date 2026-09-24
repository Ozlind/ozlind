import "./globals.css";

export const metadata = {
  title: "Ozlind AI — Intelligent Workspace",
  description:
    "Ozlind AI — your intelligent workspace for writing, research, planning, and creation.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
