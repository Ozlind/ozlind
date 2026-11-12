# Ozlind Base Version — Release Gate

## Purpose

Establish a small, dependable foundation for Ozlind before adding new capabilities. Keep the existing product identity, Supabase authentication and persisted user data. Do not replace the application with a scaffold or perform a broad rewrite.

## Release principles

- Preserve user accounts, conversations, documents, preferences, presets, and existing database migrations.
- Keep Google OAuth and Supabase Auth as the authentication boundary.
- Keep provider credentials server-only. Never place service-role or AI provider keys in browser bundles.
- Every state-changing API route must authenticate the user, validate and bound its input, verify ownership, apply abuse controls, and return a stable error shape.
- Do not report a feature as available unless its provider/configuration is present and its runtime path is verified.
- Prefer removing unused code only after checking imports, route references, migrations, and persisted data dependencies.
- No production schema, data, environment, or deployment changes during audit and preview validation.

## Base product scope

The base release keeps:
- Login, Google OAuth callback, authenticated app shell, and sign-out.
- AI chat with streaming, stop/regenerate, conversation history, and persistence.
- Text model selection and explicitly configured vision / web research paths.
- User-owned documents, preferences, presets, and artifacts that are already part of the app.
- Health/readiness endpoints and actionable failure states.

New experimental features and cosmetic additions are out of scope until the base release passes its gates. Existing features are not removed merely because they are advanced.

## Mandatory engineering gates

1. npm ci installs the exact lockfile without dependency resolution drift.
2. npm run typecheck passes.
3. npm run lint passes, and production builds do not suppress lint failures.
4. All existing unit/security/architecture tests pass.
5. npm run build completes for the exact release candidate.
6. Production dependency audit reports no unaccepted high/critical vulnerabilities; registry outages are reported as unverified, never as a pass.
7. Critical API routes are verified for authentication, input size/schema, ownership, rate limiting, no-store behavior where appropriate, and safe error responses.
8. Supabase RLS and migration history are reviewed without applying unverified migrations to Production.
9. Preview smoke tests cover login, chat streaming/persistence, history reload, stop/regenerate, preferences, documents, and mobile layout.
10. Rollback target and release commit are recorded before any production release.

## Security review checklist

- No secrets in tracked files, client code, logs, URLs, or error payloads.
- Supabase service credentials are used only in server code and only after verifying the caller.
- Every privileged database query is scoped to the authenticated user or a narrowly justified server-owned operation.
- All mutation routes use bounded request parsing and schema validation.
- Rate limits fail closed for state-changing and provider-costing operations.
- OAuth next redirects are same-origin.
- CSP, security headers, and browser permissions are checked against actual app integrations; do not weaken them just to silence console errors.
- User-provided prompt, preset, document, and web content are treated as untrusted data.
- Logs contain request identifiers and operational context, not secrets or unnecessary personal content.

## Definition of done

The Base Version is ready only when all applicable engineering and security gates pass on one exact commit, the Preview runtime smoke tests pass, and the Production deployment is verified after an explicitly approved release. A green build alone is not a release sign-off.

## Known work queue

- Review the current open pull requests for duplicate, stale, conflicting, or valuable work before closing or merging anything.
- Trace all API routes and privileged database access end-to-end.
- Add regression tests for uncovered critical API and authentication paths.
- Audit dependencies and configuration, including build-time lint enforcement.
- Trace CSS imports and component usage before deleting overlapping styles.
- Verify Preview and Production behavior without exposing or copying secret values.