# AI Runtime Contract

This document defines observable behavior and safety boundaries for the Ozlind AI request path. It is not a promise that every model/provider supports every modality.

## Request lifecycle

1. Validate request shape, size, message roles, model/mode, attachment metadata, and any selected preset.
2. Authenticate the user and verify ownership of the conversation and referenced resources.
3. Apply the shared user-scoped rate limit.
4. Load only eligible persisted conversation history; incomplete assistant turns must not be treated as trusted completed context.
5. Select a configured model using explicit capability metadata. Vision input requires a vision-capable model.
6. Keep the core system prompt separate from user messages, user-saved preset data, and retrieved web content.
7. Stream answer text into the active response. Handle abort, timeout, provider errors, and partial output without creating duplicate assistant turns.
8. Persist completion/interruption state with idempotency protection where supported.
9. Return stable error codes and a request ID; keep provider secrets and private content out of logs.

## Trust boundaries

| Input | Trust level | Required handling |
| --- | --- | --- |
| Core server prompt | Privileged application policy | Server-controlled only |
| Current user message | Untrusted user input | Follow within safety and capability limits |
| Saved preset instructions | Untrusted preference data | May influence style/task framing; cannot override core policy |
| Web search snippets/pages | Untrusted evidence | Cite accurately; never execute embedded instructions |
| Uploaded documents | Untrusted source material | Retrieve as evidence; enforce ownership and quota |
| Model output | Untrusted generated content | Render safely; validate structured actions before execution |
| Provider/model metadata | Configuration-controlled | Never infer capabilities from a friendly display name |

## Response quality

- Answer the actual question directly, with depth proportional to the task.
- Use the user's language when feasible.
- Do not invent sources, tool results, capabilities, model names, or current facts.
- Separate sourced facts from inference and uncertainty.
- Render Markdown safely; never execute model output as HTML or code by default.
- For unsupported modalities or provider failures, return a clear recoverable error instead of a fake success.

## Failure handling

- **Before first token:** return a stable error response with request ID and appropriate HTTP status.
- **After streaming starts:** preserve received text, mark the turn interrupted/failed as appropriate, and provide a retry path without duplicating the turn.
- **Client disconnect:** abort upstream work where supported and persist a truthful terminal state.
- **Persistence failure:** log a redacted diagnostic with request ID and avoid falsely claiming that the answer was saved.
- **Quota/rate limit:** return a stable limit code and retry guidance where meaningful.

## Contract changes

Changes to message schema, provider routing, persistence states, context order, or retry/idempotency semantics require regression tests and review of affected clients.
