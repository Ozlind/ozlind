# ADR 0001: Incremental Architecture and Explicit Release Gates

- **Status:** Accepted
- **Date:** 2026-10-25
- **Scope:** Ozlind AI repository engineering

## Context

Ozlind AI already has production behavior across Next.js App Router, Supabase Auth/RLS, AI provider streaming, documents, preferences, and workspace routes. A wholesale rewrite or empty Clean Architecture folders would increase risk without delivering user value.

## Decision

- Keep the existing stack and public contracts stable.
- Use the existing route handlers as HTTP boundaries and extract focused feature helpers when they reduce duplication or improve testability.
- Treat migrations as append-only and verify their target-environment status independently from Git commits.
- Require automated CI, a READY preview for the exact commit, and relevant authenticated smoke tests before production release.
- Document behavior, ownership, and failure modes; do not claim planned layers or workflows are implemented until code and tests prove it.
- Use Dependabot for routine dependency PRs, while retaining the scheduled production dependency audit as a separate security signal.

## Consequences

- Changes are smaller and easier to review, with lower risk to auth and persisted data.
- Some cross-cutting logic may remain in route handlers until a safe extraction has tests and a clear owner.
- A green build alone cannot certify production environment, live provider quotas, OAuth configuration, or deployed database state.
- Dependency updates are proposals, not auto-approved releases; CI and human review remain required.
