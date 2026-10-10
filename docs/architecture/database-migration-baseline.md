# Database migration baseline and release safety

**Status: release blocker — do not apply repository migrations to the connected production project yet.**

A read-only audit on 2026-10-10 compared the repository migration directory with the connected Supabase project's migration ledger. They do not currently form a verifiable, one-to-one history.

## Observed mismatch

- The connected database reports 22 applied migration versions, using 14-digit timestamps.
- The repository contains a smaller set of migration files, most using date-only prefixes such as `20261008_...` or `20261009_...`.
- The connected database contains applied versions not represented by an identically versioned repository file, including early October 4/6/7/8 migrations.
- A matching descriptive name is not proof that the SQL contents are identical.

Because Supabase CLI migration tracking is version-based, applying the repository as-is may cause already-applied schema changes to be treated as pending. Do not run `supabase db push`, a production migration, or migration repair until the history is reconciled.

## Required safe reconciliation procedure

1. Take and verify a restorable database backup before any migration work.
2. Recover the exact SQL for every migration recorded in the connected project's ledger from the source repository/CI artifacts, where available.
3. Compare each recovered migration to the live schema and the repository's current files. Do not infer equivalence from filenames alone.
4. Restore missing historical migration files under their exact recorded versions. Do not edit a migration that has already run in a shared environment.
5. Where original SQL cannot be recovered, document a reviewed baseline/repair plan; do not silently mark migrations applied.
6. Create a disposable Supabase development branch/project and verify both a clean database replay and an upgrade from a production-schema snapshot.
7. Review the generated schema diff, RLS policies, grants, functions, indexes, foreign keys, vector extension schema and storage policies.
8. Only then prepare a separate, reviewed production migration plan with a rollback/restore procedure.

## Document schema finding

The live `public.documents` table currently has nullable `mime` and `char_count` columns. `public.document_chunks.embedding` is nullable. A read-only count found zero document rows and zero chunk rows at audit time. The proposed additive migration `20261010101700_stage4_document_schema_reconciliation.sql` backfills metadata and enforces the runtime contract, but it has **not** been applied to the live database. Its static regression tests do not replace execution against a disposable PostgreSQL/Supabase instance.

## Security findings requiring a separate reviewed change

The live Supabase security advisor reported:

- Six legacy `public.ozlind_*` tables and `public.rate_limits` have RLS enabled with no policies. The absence of policies blocks ordinary RLS-governed access; determine whether the legacy tables are still used before adding policies or removing grants.
- `public.is_admin()` is a `SECURITY DEFINER` function executable by `authenticated`. Review its body, search all policy dependencies, then narrow exposure without breaking legitimate authorization checks.
- Leaked-password protection is disabled in Supabase Auth. Enable it through the Auth security configuration after validating the setting and user-facing sign-in implications.

No production schema, RLS, grants or Auth settings were changed during this audit.
