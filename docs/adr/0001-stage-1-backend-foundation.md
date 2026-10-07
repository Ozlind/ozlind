# ADR 0001 — OZLIND Stage 1 Backend Foundation

## Status
Accepted

## Decision

OZLIND keeps Next.js App Router + Supabase as the initial production backend foundation.

Stage 1 introduces a small platform layer for:

- versioned API entrypoints under /api/v1
- strict Zod boundary validation
- request IDs
- structured JSON logs
- trusted-origin mutation checks
- centralized API error envelopes
- dependency health checks

## Why

The existing application already uses Supabase Auth, PostgreSQL, pgvector, RLS, and server-side AI routes. Replacing those working components with a separate NestJS/FastAPI service at this stage would increase operational complexity without improving user-visible reliability.

The architecture remains modular so AI orchestration and asynchronous workers can be extracted later without rewriting domain contracts.

## Trade-offs

- Next.js Route Handlers are retained instead of introducing a second API server.
- PostgreSQL remains the source of truth instead of adding another operational database.
- Distributed rate limiting continues to use the existing database RPC until a dedicated Redis service is justified by measured traffic.
- Zod is used at API boundaries; domain services remain framework-independent.

## Non-goals

Stage 1 does not yet introduce Kubernetes, Kafka, multi-region active/active routing, or a separate worker fleet. Those are Stage 4/5 concerns and will be added only when operational metrics justify them.
