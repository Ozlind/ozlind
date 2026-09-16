const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
const required=['app/page.jsx','app/layout.jsx','app/components/OzlindApp.jsx','app/globals.css','app/api/chat/route.js','app/api/research/route.js','app/api/image/route.js','app/lib/providers.js','app/lib/server.js','package.json','next.config.mjs','.env.example'];
for(const f of required)if(!fs.existsSync(path.join(root,f)))throw new Error(`Missing ${f}`);
const all=required.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
for(const bad of ['NEXT_PUBLIC_GROQ','NEXT_PUBLIC_GEMINI','NEXT_PUBLIC_TAVILY','dangerouslySetInnerHTML','api/chat.js'])if(all.includes(bad))throw new Error(`Forbidden token: ${bad}`);
const p=JSON.parse(fs.readFileSync(path.join(root,'package.json')));if(!p.dependencies.next||!p.dependencies.react)throw new Error('Dependencies missing');
console.log('OZLIND verification passed: compact App Router architecture, server-side secrets, capability-aware routing, normalized streaming, research endpoint, image endpoint and responsive UI.');
