import "./globals.css";

export const metadata = {
  title: "OZLIND AI",
  description: "AI Platform"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
