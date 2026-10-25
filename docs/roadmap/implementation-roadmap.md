# Ozlind AI Implementation Roadmap

**Status:** Living execution plan. Update only when evidence changes; planned work is not complete work.

## Track A — Secure baseline

- [x] Establish engineering standards, architecture boundaries, release and incident runbooks.
- [x] Add automated regression coverage for system-prompt separation, document quota enforcement, and OAuth same-origin redirect behavior.
- [x] Restore same-origin browser microphone permission while keeping camera/geolocation blocked.
- [ ] Apply and verify the document quota migration in the target Supabase environment.
- [ ] Complete authenticated preview smoke tests and verify cross-user resource isolation.
- [ ] Publish Terms/Privacy/Cookie routes only after operator contact, actual provider/data-retention details, and legal review are confirmed.

## Track B — Core AI reliability

- [x] Keep user presets and web-research data out of the privileged system role.
- [x] Preserve explicit provider/model metadata and existing streaming/retry contracts.
- [ ] Exercise the configured Fast, Auto, Pro, and Vision paths against real test prompts; verify actual model capabilities and fallback behavior.
- [ ] Verify image preview persistence and image click-to-enlarge behavior on mobile and desktop.
- [ ] Verify streamed text visibly appears in-place, with no stray placeholder characters or stuck typing indicators.
- [ ] Verify cancellation, provider timeout, persistence failure, and retry paths against the preview.

## Track C — Product consistency

- [x] Define Ozlind Enterprises / Ozlind AI identity and acceptance principles.
- [x] Add issue forms, pull-request template, and weekly dependency-update proposals.
- [ ] Audit all visible controls against real behavior; remove, implement, or clearly disable non-functional controls.
- [ ] Verify all app routes, responsive layouts, keyboard/focus behavior, safe areas, and accessible names.
- [ ] Reconcile public metadata, favicon/brand assets, error states, and legal navigation.

## Track D — Operability and cost

- [x] Document environment/secrets rules and release/rollback/incident procedures.
- [ ] Confirm health/readiness behavior against the configured deployment without leaking secret values.
- [ ] Review structured logs and request IDs for sensitive data; verify useful diagnostics without private prompt/content logging.
- [ ] Add or improve provider latency/failure/cost metrics only after consent, privacy, and retention behavior are clear.
- [ ] Review quotas, timeout budgets, and rate limits under concurrent load.

## Release gate

A track is not complete merely because its documentation or code exists. Each item requires evidence from the exact commit and environment. Keep the pull request in draft until latest CI, Vercel preview, database migration status, and authenticated smoke tests have been verified.
