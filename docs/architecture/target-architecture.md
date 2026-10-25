# Ozlind AI Target Architecture

**Status:** Enforced boundaries for incremental implementation, not a claim that the repository has already been fully refactored.

## Runtime request flow

```text
Browser UI
  -> Next.js App Router page/component
  -> API route (auth + bounded parsing + schema validation + rate limit)
  -> feature helper / provider orchestration
  -> Supabase (RLS + ownership) and/or configured AI/search provider
  -> normalized result / stream
  -> UI state + persisted conversation
```

## Layer responsibilities

| Layer | Current home | Responsibility |
| --- | --- | --- |
| Presentation | `src/app/**/page.tsx`, `src/components/**` | Accessible UI, interaction state, empty/loading/error states |
| HTTP boundary | `src/app/api/**/route.ts` | Auth, request IDs, validation, rate limits, status mapping, stream lifecycle |
| Feature logic | `src/lib/ai`, `src/lib/chat`, `src/lib/documents`, `src/lib/research` | Reusable domain operations, normalized provider inputs/outputs |
| Identity/data access | `src/lib/supabase/**`, Supabase queries | Session validation, RLS, user/resource ownership |
| Persistence contract | `supabase/migrations/**`, `supabase/schema.sql` | Ordered migrations and canonical reference snapshot |
| Contracts | `types/**`, adjacent `.d.mts` files | Shared runtime/type boundaries |
| Verification | `tests/**`, `.github/workflows/**` | Regression checks and release gates |

## Dependency rules

1. UI may call same-origin API routes; it must not import service-role keys, server-only SDKs, or database admin clients.
2. Route handlers authenticate and authorize before protected reads/writes. Do not assume a valid session grants ownership of a supplied resource ID.
3. Validate payload shape and size before expensive provider/database work.
4. Reuse shared rate-limit and bounded-body helpers; do not fork local variants without a documented reason.
5. Keep provider selection and fallback on the server. Never route image input to a model unless configured metadata says it supports vision.
6. Retrieved web pages, uploaded documents, preset instructions, and user content are evidence/input, not higher-priority instructions.
7. Streaming must handle cancellation, provider failure, partial output, persistence failure, and retry/idempotency without duplicate assistant turns.
8. SQL changes must include RLS/privilege review, an ordered migration, a canonical-schema update when appropriate, and regression verification.
9. Keep route contracts stable unless an ADR and tests document the change.
10. Avoid premature Clean Architecture scaffolding: add a domain/service/repository module only when it isolates real logic or enables a concrete test.

## Required patterns for new protected endpoints

- Generate a request/correlation ID and return it in errors.
- Authenticate with the server Supabase client.
- Parse bounded JSON or multipart input and validate with Zod.
- Check ownership using RLS and explicit parent-child relationship constraints.
- Apply per-user rate limits before costly work.
- Return stable, non-sensitive error codes; log structured diagnostics without secrets or user payloads.
- Add tests for unauthorized, malformed, oversized, cross-user, rate-limited, provider-failure, and success paths as applicable.

## Database change protocol

1. Inspect current schema and migration history; do not assume the canonical snapshot is the deployed state.
2. Add a new dated migration; do not rewrite an applied migration.
3. Ensure constraints and triggers are safe for existing data and concurrent requests.
4. Update `supabase/schema.sql` if it is intended to represent the new canonical state.
5. Add architecture/test assertions and a manual rollout/rollback note for risky changes.
6. Apply through the project's controlled Supabase migration process; verify the resulting schema and RLS in the target project.
7. Never claim a migration is active in production based only on a file being committed.
