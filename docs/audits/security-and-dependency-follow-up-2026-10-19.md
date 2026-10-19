# Security and dependency follow-up â€” 2026-10-19

## Verified in the Stage 02 candidate

- `npm ci` succeeds using the committed lockfile.
- `npm audit --omit=dev --audit-level=high` passes; the production dependency tree has no high-severity audit findings at this point-in-time.
- The full `npm audit` reports seven high-severity items in development-only lint/build tooling associated with the existing Tailwind CSS 3 and Next.js lint-toolchain dependency graph. The compatible Tailwind 3 tree does not currently have a supported in-major fix for all reported ranges. These are not represented as fixed. A Tailwind/Next lint-toolchain major migration needs its own visual and build regression pass; forcing Tailwind CSS 4 during a chat-stream performance change would add avoidable UI risk.
- Five request-boundary tests and four chat-stream policy tests pass locally in the isolated build environment; GitHub CI and Vercel must pass again on the exact PR commit.

## Connected Supabase findings â€” no production DB/Auth changes made

- The live security advisor reports leaked-password protection disabled. Enable it in the Supabase Dashboard under Authentication / password security. The available project connector does not expose the Auth dashboard toggle, so this has not been enabled here.
- The live `public.is_admin()` function is `SECURITY DEFINER`, callable by `authenticated`, and used by admin RLS policies on announcements, audit logs, feature flags, feedback, profiles and usage l¶»§q«^