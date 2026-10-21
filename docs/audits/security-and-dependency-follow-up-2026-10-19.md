# Security and dependency follow-up — 2026-10-19

## Verified in the Stage 02 candidate

- `npm ci` succeeds using the committed lockfile.
- `npm audit --omit=dev --audit-level=high` passes; the production dependency tree has no high-severity audit findings at this point-in-time.
- The full `npm audit` reports seven high-severity items in development-only lint/build tooling associated with the existing Tailwind CSS 3 and Next.js lint-toolchain dependency graph. The compatible Tailwind 3 tree does not currently have a supported in-major fix for all reported ranges. These are not represented as fixed. A Tailwind/Next lint-toolchain major migration needs its own visual and build regression pass; forcing Tailwind CSS 4 during a chat-stream performance change would add avoidable UI risk.
- Five request-boundary tests and four chat-stream policy tests pass locally in the isolated build environment; GitHub CI and Vercel must pass again on the exact PR commit.

## Connected Supabase findings — no production DB/Auth changes made

- The live security advisor reports leaked-password protection disabled. Enable it in the Supabase Dashboard under Authentication / password security. The available project connector does not expose the Auth dashboard toggle, so this has not been enabled here.
- The live `public.is_admin()` function is `SECURITY DEFINER`, callable by `authenticated`, and used by admin RLS policies on announcements, audit logs, feature flags, feedback, profiles and usage logs. Do not simply revoke `EXECUTE`: that would break policy evaluation. The safe remediation is to move the helper into a non-exposed schema, grant only the required schema/function privileges, and update all dependent policies together after the production migration ledger has been reconciled.
- The connected project’s recorded migration history and repository migration filenames were previously found not to reconcile one-to-one. No production migration was applied as part of this work. The `is_admin()` exposure fix must be prepared and tested against the recovered migration baseline before release.
- Legacy `ozlind_*` and `rate_limits` tables have RLS enabled without policies in the live advisor report. A read-only privilege check confirmed no direct table privileges for `anon` or `authenticated`; keep those grants revoked while determining whether the tables are legacy/unused. Do not add broad policies as a cosmetic fix.

## Release classification

This is a repository-side remediation and audit record, not a complete penetration test. A passing build and deployment do not replace authenticated OAuth/chat/document/workspace smoke tests or the pending Supabase Dashboard/migration-ledger actions.

## Production verification update — 2026-10-21

- The live migration ledger now includes `ozlind_backend_admin_rpc_and_acl_hardening`. Read-only SQL confirms the helper is in `private.is_admin()`, the relevant RLS policies call the private helper, and `public.is_admin()` no longer exists.
- Read-only ACL checks confirm no `TRUNCATE`, `TRIGGER`, `REFERENCES`, or `MAINTAIN` grants remain for `PUBLIC`, `anon`, or `authenticated` on existing public tables. Default privileges for objects created as `postgres` were also hardened.
- A follow-up attempt to harden default privileges for `supabase_admin` was rejected by PostgreSQL: the connected `postgres` role is not a member of `supabase_admin`. The migration was **not applied** and was removed from the automatic migration set to avoid a predictable deployment failure. This remaining owner-level default ACL requires an authorized `supabase_admin` session or a supported privileged Supabase administration path; do not claim it is fixed until verified in `pg_default_acl`.
- Supabase's security advisor still reports leaked-password protection disabled. This requires enabling the Auth password-security setting in the Supabase Dashboard; it has not been changed through the available connector.
- The current chat API now loads the latest 100 messages, restores chronological order, and limits prompt history to 60,000 characters. This change is covered by a regression test and CI.
- Vercel runtime-error query returned no errors for the selected previous 24-hour window. This is not a substitute for authenticated end-to-end smoke tests or load testing.
