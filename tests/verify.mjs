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
"src/lib/supabase/middleware.ts","src/hooks/usePreferences.ts","src/lib/i18n.ts","src/lib/chat/streaming.mjs","src/lib/chat/streaming.d.mts",
"supabase/migrations/20261008_stage2_preferences.sql","supabase/migrations/20261008_stage2_workspace.sql",
"supabase/migrations/20261008_stage2_research_preference.sql",
"supabase/migrations/20261009_stage3_rate_limit_user_scope.sql",
"supabase/migrations/20261009_stage3_chat_runtime_columns.sql",
"supabase/migrations/20261009_stage3_rls_relationship_ownership.sql",
"supabase/migrations/20261009_stage3_artifact_parent_ownership.sql",
"supabase/migrations/20261009_stage3_message_parent_ownership.sql"
];
for(const file of required)if(!fs.existsSync(path.join(root,file)))problems.push("Missing required file: "+file);
const files=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=pa¶»§q«^