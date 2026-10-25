# Verification Matrix

A test is evidence only for the behavior it exercises. No single green build proves that production credentials, OAuth providers, external AI quotas, database migrations, or browser interactions are correct.

| Change area | Automated checks | Required non-CI verification |
| --- | --- | --- |
| Chat / streaming | `npm run test:chat-streaming`, `npm run test:ai-response-quality`, `npm run typecheck` | Send a prompt, observe in-place streaming, interrupt/retry, refresh persistence |
| Auth / sessions | `npm run test:security`, `npm run typecheck` | Real test-account login/logout, OAuth callback, redirect destination, expired session |
| Supabase / RLS | Architecture/security tests; SQL review | Apply migration in target environment; test own-row and cross-user access |
| Documents / RAG | Security tests and migration assertions | Upload, retrieve, delete, malformed/oversized file, quota limit, concurrent uploads |
| Presets / prompt context | `npm run test:ai-preset`, response-quality tests | Test a hostile preset and hostile retrieved page; confirm system constraints remain in force |
| Vision | Typecheck and provider-routing tests when present | Attach an image; verify vision-capable model, response, preview and persistence behavior |
| Web research | Normalization/security tests when present | Confirm sources are real, URLs are HTTP(S), errors degrade gracefully, retrieved instructions are untrusted |
| UI / responsive | Lint, typecheck, build | Mobile narrow viewport, keyboard/safe-area behavior, focus order, screen reader labels, console/network errors |
| Deployment / environment | CI + Vercel status | Verify exact commit, readiness endpoint, required environment names, logs and authenticated smoke tests |
| Dependencies | `npm audit --omit=dev --audit-level=high` | Review advisories, exploitability, compatibility and lockfile changes |

## Required full gate

```bash
npm ci
npm run verify
```

## Reporting format

Record the exact commit, command or manual path, pass/fail result, environment, and any limitation. If a test was not run, say **not run**; do not infer success from compilation or deployment state.
