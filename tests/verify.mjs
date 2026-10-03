import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const problems = [];

const required = [
  "app/page.jsx",
  "app/layout.jsx",
  "app/globals.css",
  "app/login/page.jsx",
  "app/auth/callback/route.js",
  "app/api/chat/route.js",
  "components/OzlindApp.jsx",
  "lib/providers.js",
  "lib/server.js",
  "lib/rate-limit.ts",
  "middleware.js",
  "package.json",
  ".env.example",
  "supabase/schema.sql",
  "public/ozlind-icons.svg",
];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    problems.push(`Missing required file: ${file}`);
  }
}

/* ---- every "@/..." import must resolve to a real file ---- */

const SOURCE_DIRS = ["app", "components", "lib", "constants", "types"];
const EXTENSIONS = ["", ".js", ".jsx", ".ts", ".tsx", "/index.js", "/index.ts"];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const sources = [
  ...SOURCE_DIRS.flatMap((dir) => walk(path.join(root, dir))),
  path.join(root, "middleware.js"),
].filter((file) => fs.existsSync(file));

const importPattern = /(?:from\s+|import\s*\(\s*)["']@\/([^"']+)["']/g;

for (const file of sources) {
  const text = fs.readFileSync(file, "utf8");
  let match;
  while ((match = importPattern.exec(text))) {
    const target = path.join(root, match[1]);
    const found = EXTENSIONS.some((ext) => {
      const candidate = target + ext;
      return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
    });
    if (!found) {
      problems.push(
        `Broken import "@/${match[1]}" in ${path.relative(root, file)}`,
      );
    }
  }
}

/* ---- secrets must never be exposed to the browser ---- */

for (const file of sources) {
  const text = fs.readFileSync(file, "utf8");
  if (/NEXT_PUBLIC_[A-Z_]*(KEY|SECRET|TOKEN)/.test(text)) {
    problems.push(`Secret-looking NEXT_PUBLIC_ variable in ${path.relative(root, file)}`);
  }
}

/* ---- .env.example must document the variables the code needs ---- */

const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
for (const name of [
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
]) {
  if (!envExample.includes(`${name}=`)) {
    problems.push(`.env.example is missing ${name}`);
  }
}

if (problems.length) {
  console.error("OZLIND verification FAILED:\n");
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

console.log(`OZLIND verification passed (${sources.length} source files checked).`);