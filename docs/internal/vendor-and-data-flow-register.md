# Internal Register: Vendors and Data Flows

**Internal only.** Do not publish this register unless a reviewed public subprocessor summary is created. Last reviewed: [DATE].

## Vendor inventory
For every vendor, record the legal entity, service, data categories, purpose, processing region, retention, training/use terms, subprocessors, DPA/contract, security documentation, deletion behavior, incident contact, and owner.

| Service category | Known/possible integration to verify | Data to assess | Owner / status |
|---|---|---|---|
| Hosting/deployment | Vercel | Requests, deployment logs, environment metadata | [OWNER / VERIFY] |
| Authentication/database | Supabase | Account identifiers, profiles, chats, files, preferences | [OWNER / VERIFY] |
| Sign-in identity | Google OAuth | OAuth identity fields and authentication events | [OWNER / VERIFY] |
| AI/model inference | Verify deployed model providers (historically Groq/Gemini have been used; confirm current routes/config) | Prompts, context, generated outputs, files where supported | [OWNER / VERIFY] |
| Web search | Verify current implementation | Search queries, result requests | [OWNER / VERIFY] |
| Error/analytics | Inspect dependencies and production network traffic | Diagnostics, device/request metadata | [OWNER / VERIFY] |
| Email/support | [IF USED] | Contact details, support content | [OWNER / VERIFY] |
| Payments | [IF USED] | Transaction/entitlement data | [OWNER / VERIFY] |

## Data-flow review
For each feature (chat, web search, vision, document ingestion, saved artifacts, account deletion):
1. Trace browser → Next.js route → database/storage → AI/search provider.
2. Record exactly which fields and file contents are sent at each hop.
3. Verify authorization at every server boundary and user ownership in the database.
4. Check logs, tracing, retries, caching, and error reporting for accidental content retention.
5. Confirm provider training/retention settings and contractual terms.
6. Record data region and international transfer assessment.
7. Test deletion propagation and vendor limitations.
8. Update Privacy Policy and any required user notice.

## Change management
A new vendor, model provider, analytics SDK, file-processing service, or material data-flow change requires privacy/security review before production rollout. Re-check public disclosures and contracts, and record the reviewer and date.
