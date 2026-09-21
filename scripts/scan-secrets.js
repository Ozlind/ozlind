#!/usr/bin/env node
import { execSync } from 'child_process';

const patterns = [
  'sk-[a-zA-Z0-9]{10,}',
  'sb_secret_[a-zA-Z0-9]{10,}',
  'AIza[a-zA-Z0-9_-]{10,}',
  'gsk_[a-zA-Z0-9]{10,}',
  'tvly-[a-zA-Z0-9]{10,}',
  'SERVICE_ROLE_KEY=[a-zA-Z0-9]',
];

let failed = false;

for (const pattern of patterns) {
  try {
    execSync(`grep -rE "${pattern}" src/ api/ --include="*.js" --include="*.ts" --include="*.tsx" -q --exclude=api/db-client.js`, { stdio: 'pipe' });
    console.error(`ERROR: Found potential secret pattern "${pattern}" in source code`);
    failed = true;
  } catch {
    // grep returns non-zero when no matches found - this is what we want
  }
}

// Check dist/ if it exists
for (const pattern of patterns) {
  try {
    execSync(`grep -rE "${pattern}" dist/ -q 2>/dev/null`, { stdio: 'pipe' });
    console.error(`ERROR: Found potential secret pattern "${pattern}" in dist/`);
    failed = true;
  } catch {
    // no match or dist doesn't exist
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log('No leaked secrets found in source or build output.');
  process.exit(0);
}
