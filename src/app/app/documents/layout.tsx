import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documents",
  description: "Manage and search the private documents you use with Ozlind conversations.",
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
