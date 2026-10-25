# Incident Response Runbook

Use this when Ozlind AI has a suspected security incident, data exposure, auth failure, outage, broken AI streaming, runaway provider usage, or data-integrity problem.

## Severity

- **SEV-1:** confirmed cross-user/private-data exposure, credential compromise, destructive data loss, or broad production outage.
- **SEV-2:** major feature unavailable, repeated auth failures, widespread failed responses, or uncontrolled provider cost.
- **SEV-3:** localized bug with a safe workaround and no evidence of data exposure.

When uncertain, choose the higher severity until evidence narrows the impact.

## Response sequence

1. **Contain:** stop the affected rollout or disable the feature through an approved control. Revoke/rotate exposed credentials if compromise is plausible.
2. **Preserve:** record timestamps, deployment IDs, commit SHAs, request IDs, relevant redacted logs, and affected endpoints. Do not copy user secrets or full private content into tickets.
3. **Assess scope:** identify affected accounts, resources, time window, providers, deployments, and whether RLS/ownership boundaries were crossed.
4. **Mitigate:** use the smallest reversible change that stops harm. For database incidents, avoid speculative destructive SQL.
5. **Verify:** reproduce safely with a test account, run focused tests, and validate the fix on a preview before re-release when possible.
6. **Communicate:** provide factual status, known impact, containment, and next update time. Do not speculate about scope or claim no data was accessed without evidence.
7. **Recover:** deploy the reviewed fix, confirm service behavior and data integrity, and monitor for recurrence.
8. **Learn:** write a blameless post-incident review with root cause, detection gap, impact, corrective action, owner, and due date.

## Security-specific safeguards

- Never paste access tokens, service-role keys, OAuth codes, user documents, or full private prompts into logs or issue trackers.
- Do not delete logs or evidence while investigating.
- Rotate credentials using the provider's supported process and update the matching Vercel environment securely.
- Assess notification and legal obligations with the responsible operator/counsel; do not invent compliance claims.
- Treat external web content and user-uploaded documents as untrusted inputs even when an incident appears prompt-injection related.

## Incident record template

- Severity / start time / detection source:
- Affected deployment and commit:
- User-visible impact:
- Evidence and request IDs (redacted):
- Containment action:
- Scope and confidence:
- Recovery validation:
- Follow-up actions / owners / due dates:
