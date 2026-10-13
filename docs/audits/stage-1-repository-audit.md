# Stage 1 — Repository Audit & Baseline

**Audit date:** 2026-10-13  
**Repository:** `Ozlind/ozlind`  
**Baseline branch:** `main`  
**Baseline commit:** `f24fc0d8e07400568ef72ee95c58beb159a33f33`  
**Scope:** Read-only audit and release-risk inventory. No application code, production environment variables, Supabase schema, or production deployment changed by this audit.

## Executive summary

Ozlind is an existing Next.js 15 / React 19 / TypeScript application with Supabase authentication, Google OAuth callback handling, AI chat routes, documents, research, preferences, presets, artifacts, and health/readiness endpoints. The repository is not an empty scaffold. Refactoring should therefore be incremental and preserve its current routes, data contracts, authentication, and persisted data.

The baseline tree contains 122 entries, including 77 paths under `src/`, 14 SQL migration files, and one tracked test file (`tests/verify.mjs`). The main-branch GitHub Actions workflow for the baseline commit completed successfully. This confirms the repository verification job passed for that commit; it does not prove that all live user flows work.

## Findings

### P1 — Reproducible dependency installation is not yet enforced on main

- `package.json` defines `verify` as TypeScript checking, ESLint, architecture verification, and a production build.
- The CI workflow uses `npm install`, and the main tree has no `package-lock.json`.
- The workflow runs `npm audit --omit=dev --audit-level=high` with `continue-on-error: true`; audit findings do not block the CI job.
- `next.config.ts` sets `eslint.ignoreDuringBuilds: true`. The separate `npm run verify` lint step still runs, so the explicit lint gate exists, but a standalone Next.js build does not enforce lint.

**Recommended action:** Review the existing dependency-hardening PR before introducing another lockfile or dependency workflow. Prefer one reviewed lockfile strategy, deterministic installation (`npm ci` once the lockfile is committed), and a clearly intentional security-audit policy.

### P1 — Multiple overlapping pull requests need coordination

At audit time, these pull requests were open:

- [PR #8 — Stages 3–5: backend reliability, schema and dependency hardening](https://github.com/Ozlind/ozlind/pull/8). Includes AI/API/auth changes, a proposed database migration, dependency changes, tests, and some UI changes.
- [PR #9 — Frontend-only: polish Ozlind chat and mobile experience](https://github.com/Ozlind/ozlind/pull/9). Modifies `Chat.tsx`, `AppShell.tsx`, `Sidebar.tsx`, and global layout/styles.
- [PR #10 — Chat mode menu accessibility](https://github.com/Ozlind/ozlind/pull/10). A small UI interaction change based on `main`.

PR #8 and PR #9 both touch `AppShell.tsx` and overlap in shared styling/integration. PR #10 also edits `Chat.tsx`, which PR #9 substantially changes. Merging independently without rebasing and re-running checks can introduce conflicts or lose changes.

**Recommended action:** Select a merge order, rebase each dependent branch on the accepted predecessor, review the combined diff, and rerun CI/Preview checks on the exact candidate commit. Do not merge solely because an earlier branch passed.

### P1 — Preview readiness is not equivalent to production readiness

The previous environment verification found the production `/api/ready` endpoint returning HTTP 200 with its required checks passing. The preview deployment returned HTTP 503 with Supabase, Groq, and Google readiness checks false.

**Recommended action:** Compare variable *names and target scopes* against the project’s canonical Vercel configuration without printing or copying secret values. Diagnose Preview configuration separately. Do not change Production secrets or blindly copy Production credentials into Preview. Re-run readiness and real authenticated smoke tests after the configuration is deliberately corrected.

### P1 — Database migration history must be treated as a release gate

The repository has 14 SQL migration files. PR #8 documents a mismatch between the connected database’s applied migration ledger and repository migrations, and proposes an additive reconciliation migration.

**Recommended action:** Do not apply or replay migrations against Production until the migration ledger is reconciled and the migration has been tested against a disposable database. Preserve existing RLS, ownership rules, and user data.

### P2 — Automated test coverage is currently narrow on main

The baseline tree contains `tests/verify.mjs`, a static architecture/security-pattern check. It validates required paths and selected source/schema tokens. The main tree does not contain tracked dedicated unit, integration, or browser end-to-end test suites.

**Recommended action:** Build tests around the critical existing contracts first: login/OAuth callback, chat authorization and streaming, message persistence, preferences, workspace operations, and error/abort behavior. Add browser E2E tests for the highest-risk user journeys after the test environment is stable.

### P2 — Source organization should be improved only when evidence supports it

The current repository already has clear top-level areas: App Router pages and route handlers, chat/layout/UI components, hooks, shared libraries, styles, Supabase migrations, and docs. The architecture guide explicitly recommends incremental moves and warns against creating empty Clean Architecture folders just for appearance.

**Recommended action:** Start with an import/reference inventory, component ownership, duplicate behavior, and tests. Avoid a broad file move or a backend rewrite during a frontend quality stage.

## Baseline inventory

| Area | Observed baseline |
| --- | --- |
| Framework | Next.js 15 App Router, React 19, TypeScript |
| Styling/UI | Tailwind CSS, project-owned UI components, SVG icon assets |
| Authentication | Supabase clients/middleware and Google OAuth callback route |
| API surface | Chat, documents, research, preferences, presets, artifacts, health, readiness |
| Persistence/schema | Supabase SQL migrations plus a reference schema snapshot |
| CI | GitHub Actions workflow `.github/workflows/ci.yml` |
| Verification script | `npm run verify` |
| Main commit CI | Passed at the audited baseline SHA |
| Production readiness | Previously observed HTTP 200 |
| Preview readiness | Previously observed HTTP 503; investigation remains open |

## Safe execution order after this audit

1. Resolve PR ordering and establish one verified integration candidate.
2. Diagnose Preview readiness configuration without exposing secrets.
3. Review dependency lockfile/audit changes and database migration reconciliation as separate release gates.
4. Add critical-flow tests before structural refactors.
5. Run typecheck, lint, architecture checks, production build, then Preview runtime smoke tests.
6. Test login, message sending/streaming, stop/regenerate, history, preferences/workspace, mobile layout, and failure states.
7. Merge and deploy only when the exact candidate passes its applicable gates; verify Production afterward and retain a rollback path.

## Audit limitations

This is a repository and deployment-configuration baseline, not a full browser E2E or security penetration test. A successful build or readiness endpoint alone does not prove Google OAuth, authenticated chat, database row ownership, AI provider quotas, or every mobile interaction works end-to-end. Those remain explicit verification tasks.
