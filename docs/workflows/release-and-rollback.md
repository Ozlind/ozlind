# Release and Rollback Runbook

## Release gates

A release is blocked unless all applicable gates pass:

1. GitHub CI succeeds for the exact commit (security tests, response-quality tests, TypeScript, lint, architecture checks, build, dependency audit).
2. Vercel preview is READY and tied to that same commit.
3. Authenticated browser smoke tests pass for the changed user journey.
4. Database migration is reviewed and its application status is confirmed in the target Supabase project.
5. No unresolved critical/high security finding is introduced.
6. Required environment variables exist in the target Vercel environment; secret values are never copied into logs or PR comments.
7. Rollback strategy is known for changes that alter schema, persisted data, or provider routing.

## Minimum smoke test

- Open the preview and sign in with a permitted test account.
- Send a simple prompt and confirm the answer streams into the correct message.
- Send a follow-up that relies on conversation context.
- Refresh and verify persisted conversation history.
- Exercise the changed route's success and expected error paths.
- For vision changes, attach a supported image and verify the selected model supports image input.
- For documents, test upload, retrieval, delete, and the quota boundary with a test account.
- Verify sign-out and cross-user resource isolation where relevant.
- Check narrow mobile layout and browser console/network errors.

Do not test destructive actions against real user data unless explicitly approved.

## Database migrations

- Inspect migration history before applying anything.
- Prefer expand-and-contract: add backward-compatible schema first, deploy compatible code, migrate data if needed, then remove obsolete schema in a later release.
- Back up or establish a recovery point before destructive/data-transforming operations.
- Confirm row-level security, grants, triggers, and concurrent-write behavior after migration.
- A committed SQL file does not mean the migration ran.

## Rollback

1. Pause the rollout if errors or data-integrity issues are increasing.
2. Identify the exact bad deployment and last known good deployment.
3. Roll back application code through the approved Vercel/Git release mechanism.
4. Do not automatically reverse database migrations. Determine whether the previous application can run safely against the new schema.
5. If data changed, preserve evidence and use a reviewed forward-fix or restore procedure; do not run improvised destructive SQL.
6. Re-test authentication, chat persistence, API health, and the affected workflow.
7. Record the timeline, impact, root cause, remediation, and follow-up actions in the incident log.

## Release record template

- Commit / deployment:
- CI status:
- Preview smoke test:
- Migration and target environment:
- Environment variable changes (names only):
- Rollback point:
- Known risks:
- Release owner / timestamp:
