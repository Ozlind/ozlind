#!/usr/bin/env node
import { execSync } from 'child_process';

console.log('Running verification tests...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    failed++;
  }
}

// Check required files exist
test('API routes exist', () => {
  const routes = ['chat.js', 'conversations.js', 'messages.js', 'settings.js', 'memories.js', 'upload.js', 'health.js', 'image-generate.js'];
  for (const r of routes) {
    try {
      execSync(`test -f api/${r}`, { stdio: 'pipe' });
    } catch {
      throw new Error(`Missing api/${r}`);
    }
  }
});

test('Frontend components exist', () => {
  const comps = ['Auth.tsx', 'ChatPage.tsx', 'Layout.tsx', 'Sidebar.tsx', 'SettingsPanel.tsx', 'MemoryPanel.tsx'];
  for (const c of comps) {
    try {
      execSync(`test -f src/components/${c}`, { stdio: 'pipe' });
    } catch {
      throw new Error(`Missing src/components/${c}`);
    }
  }
});

test('Favicon exists', () => {
  execSync('test -f public/favicon.svg', { stdio: 'pipe' });
});

test('Secret scan script exists', () => {
  execSync('test -f scripts/scan-secrets.js', { stdio: 'pipe' });
});

test('No raw provider names in client source', () => {
  const banned = ['groq', 'gemini', 'tavily', 'experiential'];
  for (const word of banned) {
    try {
      execSync(`grep -ri "${word}" src/ --include="*.tsx" --include="*.ts" -q`, { stdio: 'pipe' });
      throw new Error(`Found "${word}" in client source`);
    } catch {
      // non-zero exit = not found, which is good
    }
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
