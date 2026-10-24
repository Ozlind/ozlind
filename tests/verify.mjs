import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const problems=[];
const required=[
".github/workflows/dependency-security.yml",
"src/app/layout.tsx","src/app/page.tsx","src/app/login/page.tsx","src/app/app/layout.tsx",
"src/components/chat/Chat.tsx","src/components/layout/Sidebar.tsx","src/components/layout/AppShell.tsx",
"src/app/api/chat/route.ts","src/app/api/preferences/route.ts","src/app/api/documents/route.ts",
"src/app/api/research/route.ts","src/app/api/presets/route.ts","src/app/api/artifacts/route.ts",
"src/app/api/health/route.ts","src/app/api/ready/route.ts","src/lib/supabase/server.ts",
"src/lib/supabase/middleware.ts","src/hooks/usePreferences.ts","src/lib/i18n.ts","src/lib/chat/streaming.mjs","src/lib/chat/streaming.d.mts","src/lib/ai/reasoning.mjs","src/lib/ai/reasoning.d.mts",
"supabase/migrations/20261008_stage2_preferences.sql","supabase/migrations/20261008_stage2_workspace.sql",
"supabase/migrations/20261008_stage2_research_preference.sql",
"supabase/migrations/20261009_stage3_rate_limit_user_scope.sql",
"supabase/migrations/20261009_stage3_chat_runtime_columns.sql",
"supabase/migrations/20261009_stage3_rls_relationship_ownership.sql",
"supabase/migrations/20261009_stage3_artifact_parent_ownership.sql",
"supabase/migrations/20261009_stage3_message_parent_ownership.sql",
"supabase/migrations/20261023_provider_model_metadata.sql"
];
for(const file of required)if(!fs.existsSync(path.join(root,file)))problems.push("Missing required file: "+file);
const files=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(/\.(tsx?|jsx?)$/.test(entry.name))files.push(full)}}
walk(path.join(root,"src"));
for(const file of files){
 const source=fs.readFileSync(file,"utf8");
 if(/NEXT_PUBLIC_[A-Z_]*(SERVICE_ROLE_KEY|SECRET|PRIVATE_KEY|ACCESS_TOKEN|REFRESH_TOKEN)/.test(source))problems.push("Secret-looking NEXT_PUBLIC_ variable in "+path.relative(root,file));
}
const chat=fs.readFileSync(path.join(root,"src/app/api/chat/route.ts"),"utf8");
for(const token of ["z.object","createClient","streamText","AbortSignal.timeout","AbortSignal.any","idempotencyKey","X-OZLIND-Request-ID","researchContext","checkUserRateLimit","candidateIterator.next()","firstDelta","iterator.next()","idempotency.lookup_failed","modelId: fastModel","modelId: proModel","modelId: geminiModel","provider_model: selectedProviderModel ?? selectedKey",'.eq("status", "complete")'])if(!chat.includes(token))problems.push("Chat route missing "+token);
if(!chat.includes("getReasoningEffort(candidate.modelId, input.content)"))problems.push("Chat route missing adaptive reasoning effort selection");
const canonicalSchema=fs.readFileSync(path.join(root,"supabase/schema.sql"),"utf8");
const rateLimitTables=canonicalSchema.match(/create table if not exists public\.rate_limits/g)||[];
if(rateLimitTables.length!==1)problems.push("Canonical schema must define rate_limits exactly once");
for(const token of ["create table if not exists public.user_preferences","accent text not null default '#E26F4A'","create table if not exists public.presets","create table if not exists public.artifacts","provider_model text","grant execute on function public.check_rate_limit(uuid, integer, integer) to service_role"])if(!canonicalSchema.includes(token))problems.push("Canonical schema missing "+token);
const runtimeMigration=fs.readFileSync(path.join(root,"supabase/migrations/20261009_stage3_chat_runtime_columns.sql"),"utf8");
for(const token of ["add column if not exists status","add column if not exists idempotency_key","add column if not exists model","messages_user_idempotency_key_uidx"])if(!runtimeMigration.includes(token))problems.push("Runtime schema migration missing "+token);
const providerMetadataMigration=fs.readFileSync(path.join(root,"supabase/migrations/20261023_provider_model_metadata.sql"),"utf8");
for(const token of ["alter table public.messages","add column if not exists provider_model text"])if(!providerMetadataMigration.includes(token))problems.push("Provider metadata migration missing "+token);

const scheduledAudit=fs.readFileSync(path.join(root,".github/workflows/dependency-security.yml"),"utf8");
for(const token of ["schedule:", 'cron: "17 4 * * *"', "workflow_dispatch:", "npm audit --omit=dev --audit-level=high", "concurrency:", "cancel-in-progress: false"])if(!scheduledAudit.includes(token))problems.push("Scheduled dependency audit missing "+token);
const prefs=fs.readFileSync(path.join(root,"src/hooks/usePreferences.ts"),"utf8");
for(const token of ["research_enabled","default_model","auto_scroll"])if(!prefs.includes(token))problems.push("Preferences missing "+token);
const css=fs.readFileSync(path.join(root,"src/styles/globals.css"),"utf8");
for(const token of ["env(safe-area-inset-bottom)","@media(max-width:768px)"])if(!css.includes(token))problems.push("Responsive CSS missing "+token);
if(/\.app-shell:has\(\.chat-page\)\s*\{[^}]*--(?:bg|surface|accent|text|border)\s*:/s.test(css))problems.push("Chat must inherit canonical root theme tokens, not define a local palette");
for(const token of ["background: var(--surface);","border-color: var(--accent);","color: var(--text-muted);"])if(!css.includes(token))problems.push("Shared Chat theme token rule missing "+token);
if(css.includes("backdrop-filter"))problems.push("Glass/backdrop-filter styling detected");


for (const route of [
  "src/app/api/chat/route.ts",
  "src/app/api/research/route.ts",
  "src/app/api/documents/route.ts",
  "src/app/api/preferences/route.ts",
  "src/app/api/presets/route.ts",
  "src/app/api/artifacts/route.ts"
]) {
  const source = fs.readFileSync(path.join(root, route), "utf8");
  if (!source.includes("checkUserRateLimit(user.id)")) {
    problems.push(route + " must reuse the already-verified user ID for rate limiting");
  }
}

const rateLimitSource=fs.readFileSync(path.join(root,"src/lib/rate-limit.ts"),"utf8");
if(!rateLimitSource.includes("export function rateLimitErrorResponse"))problems.push("Shared rate-limit response helper is missing");
for(const token of ["RATE_LIMITED","Retry-After","RATE_LIMITER_UNAVAILABLE"])if(!rateLimitSource.includes(token))problems.push("Shared rate limiter missing "+token);
for(const [route, tokens] of [
 ["src/app/api/chat/route.ts", ["readJsonBody", "PayloadTooLargeError", "rateLimitErrorResponse"]],
 ["src/app/api/research/route.ts", ["readJsonBody", "checkUserRateLimit", "rateLimitErrorResponse"]],
 ["src/app/api/documents/route.ts", ["readJsonBody", "checkUserRateLimit", "rateLimitErrorResponse"]]
]) {
 const source=fs.readFileSync(path.join(root,route),"utf8");
 for(const token of tokens)if(!source.includes(token))problems.push(route+" missing security guard "+token);
}
const requestSecurity=fs.readFileSync(path.join(root,"src/lib/security/request.mjs"),"utf8");
for(const token of ["content-length","getReader()","PayloadTooLargeError","TextDecoder","JSON.parse"])if(!requestSecurity.includes(token))problems.push("Bounded JSON parser missing "+token);


const chatStreaming=fs.readFileSync(path.join(root,"src/lib/chat/streaming.mjs"),"utf8");
for(const token of ["CHAT_UI_FLUSH_INTERVAL_MS = 32","shouldFlushVisibleText"])if(!chatStreaming.includes(token))problems.push("Chat streaming policy missing "+token);
const chatUi=fs.readFileSync(path.join(root,"src/components/chat/Chat.tsx"),"utf8");
if(!chatUi.includes("shouldFlushVisibleText(pendingText, Date.now(), lastUiFlush, force)"))problems.push("Chat UI does not use the tested stream flush policy");

if(problems.length){console.error("OZLIND architecture verification FAILED:\n");for(const p of problems)console.error(" - "+p);process.exit(1)}
console.log("OZLIND architecture verification passed ("+files.length+" src files checked).");
