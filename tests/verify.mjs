import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const problems = [];

const required = [
  "app/page.jsx",
  "app/layout.jsx",
  "app/globals.css",
  "app/ozlind-v3.css",
  "app/login/page.jsx",
  "app/auth/callback/route.js",
  "app/api/chat/route.js",
  "app/api/health/route.js",
  "app/api/ready/route.js",
  "components/OzlindApp.jsx",
  "components/ozlind/OzlindWorkspace.jsx",
  "components/chat/Sidebar.jsx",
  "components/chat/Composer.jsx",
  "components/chat/MessageList.jsx",
  "components/settings/SettingsPanel.jsx",
  "hooks/useOzlindChat.js",
  "hooks/usePullToRefresh.js",
  "lib/chat/utils.js",
  "lib/ai/gateway.js",
  "lib/ai/chat-service.js",
  "lib/ai/research.js",
  "lib/rag/context.js",
  "lib/providers.js",
  "lib/server.js",
  "lib/rate-limit.ts",
  "lib/backend/usage.js",
  "middleware.js",
  "package.json",
  ".env.example",
  "supabase/schema.sql",
  "public/ozlind-icons.svg",
];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    problems.push("Missing required file: " + file);
  }
}

const sourceDirs = ["app", "components", "hooks", "lib", "constants", "types"];
const extensions = ["", ".js", ".jsx", ".ts", ".tsx", "/index.js", "/index.ts"];

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
  ...sourceDirs.flatMap((dir) => walk(path.join(root, dir))),
  path.join(root, "middleware.js"),
].filter((file) => fs.existsSync(file));

const importPattern = /(?:from\s+|import\s*\(\s*)["']@\/([^"']+)["']/g;

for (const file of sources) {
  const source = fs.readFileSync(file, "utf8");
  let match;

  while ((match = importPattern.exec(source))) {
    const target = path.join(root, match[1]);
    const found = extensions.some((ext) => {
      const candidate = target + ext;
      return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
    });

    if (!found) {
      problems.push(
        'Broken import "@/' +
          match[1] +
          '" in ' +
          path.relative(root, file),
      );
    }
  }

  if (/NEXT_PUBLIC_[A-Z_]*(KEY|SECRET|TOKEN)/.test(source)) {
    problems.push(
      "Secret-looking NEXT_PUBLIC_ variable in " +
        path.relative(root, file),
    );
  }
}

const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
for (const name of [
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
]) {
  if (!envExample.includes(name + "=")) {
    problems.push(".env.example is missing " + name);
  }
}

function lineCount(file) {
  return fs.readFileSync(path.join(root, file), "utf8").split("\n").length;
}

const budgets = [
  ["components/OzlindApp.jsx", 60],
  ["components/ozlind/OzlindWorkspace.jsx", 260],
  ["components/chat/Sidebar.jsx", 220],
  ["components/chat/Composer.jsx", 240],
  ["components/chat/MessageList.jsx", 220],
  ["components/settings/SettingsPanel.jsx", 220],
  ["hooks/useOzlindChat.js", 420],
  ["app/api/chat/route.js", 260],
  ["lib/ai/chat-service.js", 320],
];

for (const [file, max] of budgets) {
  if (fs.existsSync(path.join(root, file)) && lineCount(file) > max) {
    problems.push(
      file + " exceeds architecture line budget (" + lineCount(file) + " > " + max + ")",
    );
  }
}

const appShell = fs.readFileSync(
  path.join(root, "components/OzlindApp.jsx"),
  "utf8",
);
if (!appShell.includes('OzlindWorkspace')) {
  problems.push("OzlindApp must delegate to OzlindWorkspace");
}

const routeText = fs.readFileSync(
  path.join(root, "app/api/chat/route.js"),
  "utf8",
);
if (!routeText.includes("createChatStream")) {
  problems.push("Chat route must delegate to chat application service");
}
if (!routeText.includes("isTrustedSameOrigin")) {
  problems.push("Chat route origin validation missing");
}
if (!routeText.includes('X-OZLIND-Request-ID')) {
  problems.push("Chat request correlation header missing");
}

const serviceText = fs.readFileSync(
  path.join(root, "lib/ai/chat-service.js"),
  "utf8",
);
for (const token of [
  "performResearch",
  "performDocumentRetrieval",
  "generateChatResponse",
  "writeUsageLog",
]) {
  if (!serviceText.includes(token)) {
    problems.push("Chat service boundary missing " + token);
  }
}

const usageText = fs.readFileSync(
  path.join(root, "lib/backend/usage.js"),
  "utf8",
);
if (!usageText.includes("request_id")) {
  problems.push("Usage correlation field missing");
}

const cssText = fs.readFileSync(
  path.join(root, "app/ozlind-v3.css"),
  "utf8",
);
if (cssText.includes("backdrop-filter")) {
  problems.push("New OZLIND UI must not use backdrop-filter");
}
if (!cssText.includes("env(safe-area-inset-bottom)")) {
  problems.push("Mobile safe-area handling missing");
}

if (problems.length) {
  console.error("OZLIND verification FAILED:\n");
  for (const problem of problems) console.error(" - " + problem);
  process.exit(1);
}

console.log(
  "OZLIND verification passed (" +
    sources.length +
    " source files checked).",
);
