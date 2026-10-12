import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Personalize your Ozlind appearance, default AI model, language, and chat preferences.",
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
