# Environment and Secrets Contract

## Source of truth

The target Vercel project's environment configuration is the deployment source of truth. Repository documentation and `.env.example` list variable names and safe placeholders only. Never copy secret values into GitHub, logs, docs, issue reports, or chat messages.

## Rules

- Use exact environment variable names from the deployed project; do not create near-duplicate aliases without a migration plan.
- Server provider keys, Supabase service-role credentials, OAuth client secrets, and gateway credentials must never use a `NEXT_PUBLIC_*` prefix.
- Public Supabase URL/anon-key configuration may be client-visible where the existing Supabase architecture requires it; RLS remains mandatory.
- Keep development, preview, and production credentials isolated.
- When rotating a key, update the correct Vercel environment, redeploy, verify the integration, then revoke the old credential through its provider.
- Record variable **names** and affected environments in a PR, never values.
- Readiness endpoints should report missing configuration by safe variable name or generic code, not echo secret values.
- A successful build does not prove that OAuth redirect URLs, AI provider quotas, or database connectivity are valid.

## Change procedure

1. Inspect current names and usage in source and Vercel.
2. Add a safe placeholder and documentation only when a new variable is truly required.
3. Add validation that fails closed for required integrations while allowing documented optional integrations to remain disabled.
4. Configure the correct Vercel environment securely.
5. Deploy a preview and test the integration without exposing credentials.
6. Promote only after the relevant smoke test succeeds.
7. Remove obsolete variables only after verifying no deployed code path references them.

## Incident handling

If a secret may have been exposed, treat it as compromised: rotate/revoke it using the provider's official flow, update Vercel securely, redeploy, and inspect redacted logs for suspicious use. Removing a secret from the latest commit does not invalidate a leaked credential or remove it from Git history.
