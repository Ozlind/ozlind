import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create an Ozlind account to access your private AI workspace.",
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
