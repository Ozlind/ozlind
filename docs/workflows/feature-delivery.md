# Feature Delivery Workflow

Use this workflow for features, bug fixes, security changes, refactors, and UI changes.

## 1. Define the change

- State the user problem, expected behavior, non-goals, and acceptance criteria.
- Identify affected routes, UI states, API contracts, database tables/migrations, provider integrations, environment variables, and accessibility/mobile behavior.
- Classify risk: low (isolated UI), medium (API/provider behavior), high (auth, permissions, billing, data deletion, migrations, secrets).
- For architectural or externally visible contract changes, add an ADR under `docs/adr/`.

## 2. Inspect before editing

- Read the existing implementation, adjacent helpers, tests, current migration history, and environment variable names.
- Trace callers and imports before moving or deleting code.
- Preserve existing auth, persisted data, and routes unless the task explicitly changes them.
- Do not invent external service access or silently substitute fake behavior.

## 3. Implement a vertical slice

- Make the smallest complete change that delivers the behavior.
- Keep validation at the request boundary and reusable business logic in a focused helper.
- Include loading, empty, success, error, retry, offline, and cancellation states relevant to the feature.
- Treat web research, documents, presets, and model outputs as untrusted.
- Add database migrations rather than relying on manual dashboard edits.
- Never include secrets, tokens, full prompts, uploaded documents, or private user data in logs.

## 4. Verify locally/through CI

Run the relevant focused test first, then the full gate:

```bash
npm ci
npm run verify
```

If the change touches SQL, also inspect migration ordering, RLS policies, grants, concurrent writes, and rollback behavior. If browser interaction changes, test mobile and desktop behavior on the preview; a production build is not a browser smoke test.

## 5. Review the pull request

The PR must include:
- problem and user-visible behavior;
- important implementation decisions;
- database/environment changes and migration order;
- tests actually run and their results;
- known limitations and rollout/rollback notes;
- screenshots or short recordings for meaningful UI changes.

Keep PRs focused. Do not mark a change production-ready while checks are pending or required manual validation is incomplete.

## 6. Deploy and observe

- Inspect the preview created from the exact head commit.
- Smoke-test affected authenticated flows and relevant failure paths.
- Check Vercel deployment status and runtime logs; verify Supabase migration state separately.
- Release only after required checks pass and no unresolved critical/high security blocker remains.
- Watch error rates, latency, provider fallback, and user-visible failures after rollout.
