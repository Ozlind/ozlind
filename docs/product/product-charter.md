# Ozlind AI — Product Charter

**Organization:** Ozlind Enterprises  
**Product:** Ozlind AI  
**Owner:** Athul  
**Document status:** Working product contract; review when scope or product behavior changes.

## Mission

Build a dependable, private-by-default, multilingual AI workspace that helps people think, learn, create, research, and work with their own conversations and documents. Quality is judged by user outcomes and verified behavior—not by a long feature list.

## Product principles

1. **Truth before theatrics.** Never fabricate a source, tool action, deployment, capability, or test result. State uncertainty when evidence is insufficient.
2. **Fast, visible work.** Stream answers in place, show useful progress for long operations, and recover cleanly from cancellation or provider failure.
3. **Context with boundaries.** Use relevant conversation history and user-selected preferences, but never let retrieved web content or user-supplied preset text override system safety.
4. **Private by default.** Keep provider credentials server-side, isolate user data, minimize telemetry, and make retention/provider behavior explicit.
5. **Multilingual by design.** Respond in the user's language when feasible; do not make the product English-only by assumption.
6. **Accessible and mobile-first.** Keyboard, touch, safe-area, responsive layout, readable states, and clear error recovery are product requirements.
7. **Real integrations only.** A UI control must do what it says or be clearly unavailable; no fake actions or placeholder success states.
8. **One coherent identity.** The organization is Ozlind Enterprises; the product is Ozlind AI. The owner is named only where relevant.

## Quality attributes

- **Correctness:** validated input, stable error contracts, ownership enforcement, and regression tests.
- **Reliability:** bounded timeouts, provider fallback where supported, streaming cancellation, idempotency, and durable persistence.
- **Security:** least privilege, RLS, safe redirects, prompt-injection boundaries, request-size limits, rate limits, and dependency review.
- **Performance:** stream first visible text quickly, avoid unnecessary queries and duplicate work, and keep payloads bounded.
- **Operability:** request IDs, redacted structured logs, readiness checks, deployment traceability, and a written rollback path.
- **Maintainability:** small cohesive modules, documented decisions, deterministic installs, and a green required verification gate.

## Feature acceptance contract

A feature is not complete until:
- its user-visible behavior and failure states are defined;
- protected API/database access checks authentication and ownership;
- real behavior replaces any fake control or mock path in production code;
- automated tests cover its important regressions;
- mobile/accessibility impact is reviewed;
- environment and migration requirements are documented;
- CI passes and preview smoke tests validate the affected journey.

## Explicit non-goals

- Claiming parity with any external AI company or proprietary model without evidence.
- Exposing hidden chain-of-thought as a user-facing feature.
- Publishing legal/privacy guarantees that have not been verified against actual data flows.
- Rewriting the entire app solely to adopt fashionable folder names or frameworks.
