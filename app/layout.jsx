import "./globals.css";

export const metadata = {
  title: "OZLIND AI — AI Workspace",
  description: "OZLIND AI — a focused AI workspace for conversation, research and vision."
};

export default function RootLayout({ children }) {
  return <html lang="en"><body data-theme="dark">{children}</body></html>;
}
