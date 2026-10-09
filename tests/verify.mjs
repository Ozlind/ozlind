import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const problems=[];
const required=[
"src/app/layout.tsx","src/app/page.tsx","src/app/login/page.tsx","src/app/app/layout.tsx",
"src/components/chat/Chat.tsx","src/components/layout/Sidebar.tsx","src/components/layout/AppShell.tsx",
"src/app/api/chat/route.ts","src/app/api/preferences/route.ts","src/app/api/documents/route.ts",
"src/app/api/research/route.ts","src/app/api/presets/route.ts","src/app/api/artifacts/route.ts",
"src/app/api/health/route.ts","src/app/api/ready/route.ts","src/lib/supabase/server.ts",
"src/lib/supabase/middleware.ts","src/hooks/usePreferences.ts","src/lib/i18n.ts",
"supabase/migrations/20261008_stage2_preferences.sql","supabase/migrations/20261008_stage2_workspace.sql",
"supabase/migrations/20261008_stage2_research_preference.sql",
"supabase/migrations/20261009_stage3_rate_limit_user_scope.sql"
];
for(const file of required)if(!fs.existsSync(path.join(root,file)))problems.push("Missing required file: "+file);
const files=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(/\.(tsx?|jsx?)$/.test(entry.name))files.push(full)}}
walk(path.join(root,"src"));
for(const file of files){
 const source=fs.readFileSync(file,"utf8");
 if(/NEXT_PUBLIC_[A-Z_]*(KEY|SECRET|TOKEN)/.test(source))problems.push("Secret-looking NEXT_PUBLIC_ variable in "+path.relative(root,file));
}
const chat=fs.readFileSync(path.join(root,"src/app/api/chat/route.ts"),"utf8");
for(const token of ["z.object","createClient","streamText","AbortSignal.timeout","idempotencyKey","X-OZLIND-Request-ID","researchContext","checkUserRateLimit","RATE_LIMITED","Retry-After"])if(!chat.includes(token))problems.push("Chat route missing "+token);
const prefs=fs.readFileSync(path.join(root,"src/hooks/usePreferences.ts"),"utf8");
for(const token of ["research_enabled","default_model","auto_scroll"])if(!prefs.includes(token))problems.push("Preferences missing "+token);
const css=fs.readFileSync(path.join(root,"src/styles/globals.css"),"utf8");
for(const token of ["env(safe-area-inset-bottom)","@media(max-width:768px)"])if(!css.includes(token))problems.push("Responsive CSS missing "+token);
if(css.includes("backdrop-filter"))problems.push("Glass/backdrop-filter styling detected");
if(problems.length){console.error("OZLIND architecture verification FAILED:\n");for(const p of problems)console.error(" - "+p);process.exit(1)}
console.log("OZLIND architecture verification passed ("+files.length+" src files checked).");