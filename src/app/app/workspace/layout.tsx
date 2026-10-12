import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Save reusable AI presets and keep important outputs together in your Ozlind workspace.",
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
