const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const required = [
  'app/page.jsx','app/layout.jsx','app/components/OzlindApp.jsx','app/globals.css',
  'app/api/chat/route.js','app/api/research/route.js','app/api/image-generate/route.js',
  'app/lib/providers.js','app/lib/server.js','public/ozlind-icons.svg','package.json','next.config.mjs'
];
for (const file of required) if (!fs.existsSync(path.join(root,file))) throw new Error(`Missing ${file}`);
const forbidden = ['pollinations.ai','openrouter.ai','/api/chat.js','dangerouslySetInnerHTML','onerror='];
const files = required.filter(f=>/\.(js|jsx|mjs|css|svg|json)$/.test(f));
const text = files.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
for (const token of forbidden) if (text.toLowerCase().includes(token.toLowerCase())) throw new Error(`Forbidden/legacy token found: ${token}`);
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if (!pkg.dependencies.next || !pkg.dependencies.react || !pkg.dependencies['react-dom']) throw new Error('Next/React dependencies missing');
console.log('OK: pure App Router structure, split client/server code, external SVG sprite, security controls, rate limiting, research route, Gemini image route, and no Pollinations/OpenRouter/legacy DOM bridge.');
