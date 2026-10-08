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
  "app/api/health/route.js",
  "app/api/ready/route.js",
  "components/OzlindApp.jsx",
  "lib/providers.js",
  "lib/ai/gateway.js",
  "lib/ai/research.js",
  "lib/rag/context.js",
  "lib/chat/utils.js",
  "components/account/AccountControls.jsx",
  "hooks/usePullToRefresh.js",
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

const tokenText = fs.readFileSync(path.join(root, "app/tokens.css"), "utf8");
if (!tokenText.includes("--oz-clay: #E26F4A")) problems.push("Clay Orange token missing");
if (!tokenText.includes("--background: #FFFCF4")) problems.push("Warm Ivory token missing");
if (tokenText.includes("#7057f7") || tokenText.includes("#927eff")) problems.push("Legacy purple token remains");
const appPath = path.join(root, "components/OzlindApp.jsx");
const appText = fs.readFileSync(appPath, "utf8");
if (appText.split("\n").length > 4200) problems.push("OzlindApp.jsx remains an oversized monolith");
const routeText = fs.readFileSync(path.join(root, "app/api/chat/route.js"), "utf8");
if (routeText.split("\n").length > 700) problems.push("Chat API route remains an oversized orchestration monolith");
if (!appText.includes("SpeechRecognition") || !appText.includes("voice-input-button")) problems.push("Voice input control missing");
const chatText = fs.readFileSync(path.join(root, "app/api/chat/route.js"), "utf8");
if (!chatText.includes("MAX_CHAT_REQUEST_BYTES") || !chatText.includes("X-OZLIND-Request-ID")) problems.push("Chat hardening missing");
const gatewayText = fs.readFileSync(path.join(root, "lib/ai/gateway.js"), "utf8");
if (!gatewayText.includes("streamFromProviders")) problems.push("AI gateway provider boundary missing");
const healthText = fs.readFileSync(path.join(root, "app/api/health/route.js"), "utf8");
if (!healthText.includes('status: "ok"')) problems.push("Health endpoint missing");
const readyText = fs.readFileSync(path.join(root, "app/api/ready/route.js"), "utf8");
if (!readyText.includes('status: "not_ready"') || !readyText.includes("createAdminClient")) problems.push("Readiness dependency check missing");
if (!chatText.includes("AbortController")) problems.push("Chat timeout/cancellation hardening missing");
if (!appText.includes("const controller = new AbortController()")) problems.push("Client chat cancellation missing");
if (!appText.includes("let event;") || !appText.includes("handleEvent(event)")) problems.push("Streaming event parser hardening missing");
if (!appText.includes("controller.userStopped = true")) problems.push("Stop-generation state missing");
if (!appText.includes("aria-modal=\"true\"")) problems.push("Modal accessibility missing");
const premiumText = fs.readFileSync(path.join(root, "app/premium.css"), "utf8");
if (!premiumText.includes(".profile-avatar img")) problems.push("Profile avatar containment missing");
if (!premiumText.includes("env(safe-area-inset-bottom")) problems.push("Mobile safe-area handling missing");
if (!premiumText.includes("@media (max-width: 640px)")) problems.push("Mobile responsive rules missing");

if (problems.length) {
  console.error("OZLIND verification FAILED:\n");
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

console.log(`OZLIND verification passed (${sources.length} source files checked).`);