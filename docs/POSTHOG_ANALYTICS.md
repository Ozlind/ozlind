# PostHog analytics setup

Ozlind has a lightweight, dependency-free browser integration for privacy-conscious product telemetry.

## Configure the project

In the PostHog project settings, copy the **Project API key** (public ingest key, not a personal API key) and identify the correct ingest host for the project's region.

Set these environment variables in Vercel for Preview and Production, and in local development when needed:

- `NEXT_PUBLIC_POSTHOG_KEY`: the PostHog **Project API key**.
- `NEXT_PUBLIC_POSTHOG_HOST`: the project's ingest host, for example `https://us.i.posthog.com` for a US-hosted project. Use the host shown by PostHog for your project region.

Redeploy after adding or changing environment variables. Analytics remains inactive when the key is unset.

## Events sent

- `$pageview`: client-side route page views.
- `ozlind_client_error`: browser error category and source only; raw error messages and stack traces are intentionally excluded.

The integration does not send chat prompts, AI responses, uploaded file contents, authentication tokens, query strings, or raw exception messages. URL paths are normalized to mask UUID-like and long identifier segments. It uses a random pseudonymous browser ID stored in local storage, and respects browser Do Not Track and the `ozlind_analytics_opt_out=1` local-storage opt-out flag.

## Verify ingestion

1. Deploy with the two environment variables configured.
2. Open Ozlind in a fresh browser session and navigate between pages.
3. In PostHog, open Live Events and confirm `$pageview` events arrive.
4. Confirm `ozlind_client_error` appears only when a browser-side error occurs.
5. If events do not appear, verify the key, region host, browser network requests to `/i/v0/e/`, and any content-security/CORS restrictions.

This integration does not enable Session Replay. Replay requires a separate privacy review and explicit configuration before it should be enabled.
