// OZLIND AI — post-deploy smoke tests.
//
// Run against a live deployment:
//   BASE_URL=https://your-app.vercel.app node tests/verify.js
//
// This script exercises the real HTTP surface of the app (no mocks). Tests
// that need a provider API key are SKIPPED (never reported as passed) when
// /api/health says that service isn't configured. It complements, but does
// not replace, manual verification of streaming/UI behavior in a browser
// (see README "What to verify by hand").

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

let passed = 0, failed = 0, skipped = 0;

function report(name, status, detail = '') {
  const icon = status === 'pass' ? '✅' : status === 'skip' ? '⏭️ ' : '❌';
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ''}`);
  if (status === 'pass') passed++;
  else if (status === 'skip') skipped++;
  else failed++;
}

async function main() {
  console.log(`\nOZLIND AI verification against ${BASE_URL}\n`);

  // 1. Homepage loads
  try {
    const resp = await fetch(BASE_URL);
    const html = await resp.text();
    if (resp.ok && html.includes('root')) report('Homepage responds with HTML shell', 'pass');
    else report('Homepage responds with HTML shell', 'fail', `status ${resp.status}`);
  } catch (err) {
    report('Homepage responds with HTML shell', 'fail', err.message);
  }

  // 2. Health endpoint
  let health = null;
  try {
    const resp = await fetch(`${BASE_URL}/api/health`);
    const data = await resp.json();
    if (resp.ok && data.services) { health = data.services; report('/api/health returns service status', 'pass'); }
    else report('/api/health returns service status', 'fail', JSON.stringify(data));
  } catch (err) {
    report('/api/health returns service status', 'fail', err.message);
  }

  // 3. Chat input validation (no key required)
  try {
    const resp = await fetch(`${BASE_URL}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '' }) });
    if (resp.status === 400) report('/api/chat rejects empty message with 400', 'pass');
    else report('/api/chat rejects empty message with 400', 'fail', `status ${resp.status}`);
  } catch (err) {
    report('/api/chat rejects empty message with 400', 'fail', err.message);
  }

  // 4. Chat streaming (needs Groq or Gemini)
  if (health && (health.groq || health.gemini)) {
    try {
      const resp = await fetch(`${BASE_URL}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Say the single word: pong', mode: 'fast' }) });
      const text = await resp.text();
      if (resp.ok && text.includes('data:')) report('Fast chat streams a real SSE response', 'pass');
      else report('Fast chat streams a real SSE response', 'fail', `status ${resp.status}`);
    } catch (err) {
      report('Fast chat streams a real SSE response', 'fail', err.message);
    }
  } else {
    report('Fast chat streams a real SSE response', 'skip', 'GROQ_API_KEY / GEMINI_API_KEY not configured');
  }

  // 5. Research (needs Tavily)
  if (health && health.tavily) {
    try {
      const resp = await fetch(`${BASE_URL}/api/research`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'current weather in Paris' }) });
      const data = await resp.json();
      if (resp.ok && Array.isArray(data.sources)) report('/api/research returns real sources', 'pass');
      else report('/api/research returns real sources', 'fail', JSON.stringify(data));
    } catch (err) {
      report('/api/research returns real sources', 'fail', err.message);
    }
  } else {
    report('/api/research returns real sources', 'skip', 'TAVILY_API_KEY not configured');
  }

  // 6. Files endpoint validation (no key required)
  try {
    const resp = await fetch(`${BASE_URL}/api/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: 'x.exe', fileBase64: 'AA==', contentType: 'application/x-msdownload' }) });
    if (resp.status === 415) report('/api/files rejects unsupported file types', 'pass');
    else report('/api/files rejects unsupported file types', 'fail', `status ${resp.status}`);
  } catch (err) {
    report('/api/files rejects unsupported file types', 'fail', err.message);
  }

  // 7. Conversations require auth
  try {
    const resp = await fetch(`${BASE_URL}/api/conversations`);
    if (resp.status === 401) report('/api/conversations requires authentication', 'pass');
    else report('/api/conversations requires authentication', 'fail', `status ${resp.status}`);
  } catch (err) {
    report('/api/conversations requires authentication', 'fail', err.message);
  }

  // 8. Supabase configuration
  if (health) {
    if (health.supabase) report('Supabase connection is configured', 'pass');
    else report('Supabase connection is configured', 'fail', 'not configured');
  } else {
    report('Supabase connection is configured', 'skip', 'health check unavailable');
  }

  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  console.log('Manual checks not covered by this script (require a real browser):');
  console.log('  - Stop/regenerate/edit UI interactions, markdown rendering, mobile layout,');
  console.log('    magic-link email sign-in round trip, and image/PDF understanding end-to-end.');

  if (failed > 0) process.exit(1);
}

main();
