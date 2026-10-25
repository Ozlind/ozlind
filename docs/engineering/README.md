# Ozlind Engineering System

**Product:** Ozlind AI  
**Organization:** Ozlind Enterprises  
**Owner:** Athul  
**Status:** Working engineering standard; apply to all new changes.

This folder links the minimum operational system required to build and release Ozlind safely. It complements the source code; it does not imply that unimplemented capabilities exist.

## Start here

1. [Product charter](../product/product-charter.md) — mission, principles, and completion criteria.
2. [Architecture boundaries](../architecture/target-architecture.md) — runtime ownership, data flow, and dependency rules.
3. [AI runtime contract](../architecture/ai-runtime-contract.md) — trust boundaries, streaming, and failure semantics.
4. [Environment and secrets](../operations/environment-and-secrets.md) — Vercel configuration and credential handling.
5. [Feature delivery workflow](../workflows/feature-delivery.md) — requirements through review and verification.
6. [Release and rollback](../workflows/release-and-rollback.md) — preview gates, migrations, production rollout, and rollback.
7. [Incident response](../workflows/incident-response.md) — security, availability, and data-integrity events.
8. [Verification matrix](../testing/verification-matrix.md) — test commands and what they do not prove.
9. [Repository structure](../architecture/project-structure.md) — current code map.

## Non-negotiable engineering rules

- Preserve Next.js 15 App Router, TypeScript, Supabase Auth/Google OAuth, existing user data, and current API contracts unless a reviewed migration explicitly changes them.
- Prefer small vertical slices with tests over broad rewrites or empty architecture folders.
- All user input, model output, retrieved web content, uploaded documents, and saved presets are untrusted.
- Every protected data operation must verify identity, resource ownership, input shape, and failure behavior.
- Database changes are append-only migrations; never silently mutate a live database from application startup.
- CI green is necessary, not sufficient: preview smoke tests and production runtime checks are separate gates.
- Never claim deployment, migration, feature, or live test success without tool evidence.
- Keep secrets out of source control and client-exposed environment variables.
