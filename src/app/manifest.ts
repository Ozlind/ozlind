import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Ozlind — A calmer AI workspace",
    short_name: "Ozlind",
    description: "A focused AI workspace for thoughtful conversations, useful documents, and work worth keeping.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#faf9f5",
    theme_color: "#f7f7f5",
    lang: "en",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "New chat",
        short_name: "New chat",
        description: "Start a new Ozlind conversation",
        url: "/app",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
    ],
  };
}
