import fs from "node:fs";
import path from "node:path";

const required = [
  "app/page.jsx",
  "app/layout.jsx",
  "app/globals.css",
  "app/api/chat/route.js",
  "app/api/research/route.js",
  "components/OzlindApp.jsx",
  "lib/providers.js",
  "lib/server.js",
  "package.json",
  ".env.example",
];

for (const file of required) {
  if (!fs.existsSync(path.join(process.cwd(), file))) {
    throw new Error(`Missing ${file}`);
  }
}

console.log("OZLIND structure verification passed.");
