const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const required = [
  'app/page.jsx',
  'app/layout.jsx',
  'app/globals.css',
  'app/api/route.js',
  'app/not-found.jsx',
  'app/loading.jsx',
  'public/ozlind-mark.svg',
  'package.json',
  'next.config.mjs',
  '.env.example',
  'BUILD_1000_STAGES.md',
  'public/ozlind-icons-sprite.svg',
];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const page = fs.readFileSync(path.join(root, 'app/page.jsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/api/route.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');

if (!page.startsWith("'use client';")) throw new Error('page.jsx must be a client component.');
if (!route.includes('export async function POST')) throw new Error('API POST handler is missing.');
if (!route.includes('export async function GET')) throw new Error('API GET health handler is missing.');
if (!page.includes("fetch('/api'")) throw new Error('Frontend must call the existing /api route.');
if (page.includes('/api?action=image')) throw new Error('Image generation must be removed from this release.');
if (page.includes('Image generation')) throw new Error('Image generation UI text must be absent.');
if (route.includes('handleImage')) throw new Error('Image generation server handler must be absent.');
if (!page.includes('Vision & Files')) throw new Error('Vision/files UI is missing.');
if (!page.includes('Research')) throw new Error('Research UI is missing.');
if (!page.includes('customInstructions')) throw new Error('Custom instructions are missing.');
if (!page.includes('Memory')) throw new Error('Memory control is missing.');
if (!css.includes('.app-shell')) throw new Error('Current CSS shell is missing.');
if (!css.includes('.composer')) throw new Error('Composer styles are missing.');

console.log('OZLIND structural verification passed.');

const sprite = fs.readFileSync(path.join(root, 'public/ozlind-icons-sprite.svg'), 'utf8');
for (const id of ['ozl-mark','ozl-node','i-ai-chat','i-web-research','i-attach','i-send','i-stop','i-copy','i-edit','i-regenerate','i-delete','i-more','i-expand','i-collapse','i-open-external','i-download','i-upload','i-clear','i-refresh','i-bookmark','i-share','i-plus','i-check','i-arrow-up','i-arrow-right','src-fallback']) { if (!sprite.includes(`id=\"${id}\"`)) throw new Error(`Missing SVG symbol: ${id}`); }
console.log('SVG sprite verification passed.');
