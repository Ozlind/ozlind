# ADR 0002 — Chat streaming responsiveness and persistence

## Status
Accepted for Stage 02.

## Decision

- Render buffered provider text through a tested 32 ms UI flush policy rather than scheduling a React state update for every tiny provider chunk.
- Serialize periodic assistant-message checkpoints on a non-blocking queue. Token delivery must not wait for each intermediate database write.
- Persist the final assistant message after outstanding checkpoints finish, and verify that the final update returned the row before closing the stream.
- Keep the database as the source of truth and retain request cancellation/provider timeouts.
- Upgrade to AI SDK v5 with the documented message/token/media type names while preserving the existing Supabase and Gemini environment variable names, model mapping, vision input and client response headers.

## Why

The previous 150 ms checkpoint loop awaited a Supabase write inline with token delivery, so database latency could stall the live stream. A serialized checkpoint queue decouples the visible stream from those periodic writes without allowing older snapshots to overwrite newer ones. A verified final write remains mandatory.

## Trade-offs

- A crash during generation can leave the last checkpoint up to 750 ms behind the last token; the completed response is always written and checked before success is returned.
- The 32 ms rendering cadence improves perceived responsiveness but does not change provider first-token latency.
- AI SDK v5 requires an explicit dependency/API migration; conversation storage schema and public chat stream contract remain unchanged.

## Verification

The Stage 02 CI gate runs Node tests for request-size guards and stream flush policy, TypeScript, ESLint, repository architecture checks, production build and a blocking production dependency audit. Authenticated provider streaming still requires an end-to-end live smoke test.
