const fs = require('fs');
const required = [
  'app/page.jsx',
  'app/layout.jsx',
  'app/globals.css',
  'app/api/route.js',
  'package.json',
  'next.config.mjs',
  '.env.example',
];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
}
const all = required.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
for (const token of ['NEXT_PUBLIC_GROQ', 'NEXT_PUBLIC_GEMINI', 'NEXT_PUBLIC_TAVILY', 'dangerouslySetInnerHTML']) {
  if (all.includes(token)) throw new Error(`Forbidden token: ${token}`);
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!pkg.dependencies?.next || !pkg.dependencies?.react || !pkg.dependencies?.['react-dom']) throw new Error('Core dependencies missing');
console.log('OZLIND production structure verification passed.');
