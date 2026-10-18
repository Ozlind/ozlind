# Ozlind Codebase Quality Audit — 2026-10-18

**Scope:** Static review of the current `main` tree, API route boundaries, project configuration, CI workflow, selected UI code, repository tree, and open pull requests. This is not a penetration test, full browser E2E run, or a live production data-flow verification.

## Executive summary

The project has a coherent Next.js App Router foundation and sensible separation between routes, components, shared libraries, and Supabase migrations. The latest main commit and Vercel production deployment were observed as successful during this review. That proves the current candidate built and deployed; it does not prove all product journeys are correct.

One security issue was confirmed in the current OAuth callback: the `next` parameter was accepted whenever it started with `/`, which is not sufficient to prevent protocol-relative external redirects (for example, `//example.com`). A same-origin URL validation fix is being proposed separately and must pass CI before it is merged.

## Findings

### P1 — OAuth callback allowed unsafe redirect destinations

**Evidence:** `src/app/auth/callback/route.ts` used `next?.startsWith("/")` before constructing a redirect URL. A value such as `//attacker.example` starts with a slash but can resolve to an external origin.

**Risk:** Users completing Google OAuth could be redirected to an attacker-controlled site, enabling phishing and confusing post-login flows.

**Action:** Validate the parsed destination's origin against the callback origin and fall back to `/app`. The fix is proposed in a separate PR; do not consider this finding closed until the fix is merged and the production deployment is verified.

### P1 — Expensive endpoints do not share the chat rate limit

**Evidence:** `src/app/api/chat/route.ts` calls the database-backed `checkUserRateLimit()`. The reviewed `src/app/api/research/route.ts` and `src/app/api/documents/route.ts` perform provider-backed search/embedding work without the same route-level limiter.

**Risk:** An authenticated user or automated client could repeatedly invoke provider-costing search/embedding operations. Authentication alone does not control request volume or spend.

**Action:** Add per-user limits and provider timeout/concurrency budgets to research and document ingestion/search. Use separate sensible budgets by operation; return `429` with `Retry-After`. Verify that limits work across multiple instances and fail closed when the limiter is unavailable. Do not change quotas without observing expected user traffic and provider costs.

### P1 — Dependency installation is not deterministic and audit does not gate CI

**Evidence:** The repository tree has no `package-lock.json`; CI runs `npm install`. The dependency audit step uses `continue-on-error: true`, so audit findings do not fail the workflow.

**Risk:** Installs can resolve dependency versions differently over time, and known high-severity dependency findings can coexist with a green CI result.

**Action:** Review dependency changes, commit one canonical lockfile, switch CI to `npm ci`, and make dependency-audit exceptions explicit and time-limited. Re-run the full production build before merge. Do not blindly regenerate or upgrade the entire dependency graph in a single change.

### P1 — Critical user flows lack automated integration/browser coverage

**Evidence:** The tracked test inventory contains `tests/verify.mjs`, a static source/schema-token check. It is not a test of real OAuth exchange, chat streaming, cancellation, persistence, cross-user access, or mobile interactions.

**Risk:** Typecheck/lint/build can pass while runtime behavior is broken.

**Action:** Add integration and E2E coverage in a staged order: Google OAuth callback and redirect validation; authenticated chat send/stream/stop/regenerate/retry; conversation ownership; document ingest/search/delete; preferences and workspace CRUD; mobile keyboard/safe-area/overflow; and provider/database failure states. Use a disposable test database and test credentials, never Production data.

### P2 — Project structure documentation has a stale path

**Evidence:** `docs/architecture/project-structure.md` lists `src/lib/utils.ts`, but that file is absent from the current `main` tree. The rest of the tree has evolved since the guide was written.

**Risk:** Contributors can follow incorrect file paths or assume utilities exist when they do not.

**Action:** Refresh the architecture map from the actual tree and add a lightweight check for documented paths. Keep proposals explicitly labeled as future work.

### P2 — Long-lived pull requests create integration and release risk

**Evidence:** The repository currently has numerous open PRs, including overlapping chat/layout changes, earlier stage branches, backend/schema hardening, and more than one OAuth redirect fix. Some branches target a non-main base; PR #25 was not mergeable against the updated main when checked.

**Risk:** Duplicate fixes, stale assumptions, conflicting UI work, and regressions from merging a branch whose checks ran against an older base.

**Action:** Maintain one integration queue. For every PR: rebase/update against current main, inspect the complete diff, run CI and Vercel preview on the exact head, and merge one cohesive change at a time. Close duplicate/stale PRs only after comparing their unique changes; do not bulk-close or bulk-merge.

### P2 — Microphone policy may conflict with future voice UX

**Evidence:** `next.config.ts` sends `Permissions-Policy: microphone=()`, which denies microphone use to the page. The reviewed current `Chat.tsx` does not contain a browser microphone capture implementation.

**Risk:** If voice input is presented or added without updating the policy, microphone access will fail regardless of the user's browser permission.

**Action:** Keep microphone disabled if voice capture is not a shipped feature. If voice input is implemented, deliberately allow microphone for the same origin and test permission-denied, unsupported-browser, and mobile cases. Do not loosen the policy preemptively.

### P2 — Security audit and deployment status are not equivalent to live-flow verification

**Evidence:** The main CI verifies TypeScript, ESLint, architecture checks, and a production build. `/api/ready` checks required environment-variable presence rather than proving a real database transaction or provider inference. The audit did not run authenticated browser tests.

**Risk:** A green build/readiness response can be mistaken for a fully healthy product.

**Action:** Keep separate release gates for build, dependency/security review, readiness, authenticated smoke tests, and provider/database runtime telemetry. Never log or expose secret values while diagnosing environment mismatches.

### P3 — Global stylesheet is a large concentration of UI behavior

**Evidence:** `src/styles/globals.css` is approximately 77 KB and contains shared layout/theme/component styles.

**Risk:** Broad CSS selectors or repeated overrides can cause cross-page visual regressions and make ownership harder to understand.

**Action:** Do not rewrite it all at once. First identify duplicate selectors, unused rules, specificity conflicts, and page ownership; add visual regression checks; then extract cohesive styles gradually while preserving the current visual system.

## Project structure assessment

The current structure is appropriate for an incremental product: App Router pages/API handlers, feature components, shared hooks/libraries, Supabase clients, styles, migrations, and docs. A wholesale Clean Architecture rewrite or mass deletion is not justified by the tree alone.

Recommended future boundaries:
- Keep route handlers thin: validate input, authenticate/authorize, apply limits, call a service, map the response.
- Keep provider orchestration and persistence helpers server-only.
- Keep shared UI primitives separate from feature components.
- Treat SQL migrations as append-only and reconcile migration history before any production database operation.
- Add tests before moving modules; delete files only after checking imports, dynamic references, scripts, and migration dependencies.

## Verification record

- Main commit reviewed: `4ddbb77bfba82ccc628b80f9bfaf722abe615fdc`.
- The main CI run for that commit completed successfully.
- The Vercel production deployment for that commit reached `READY`.
- These checks do not replace the follow-up integration/browser/security tests listed above.
