# Internal Policy: Data Retention and Deletion

**Internal document — do not publish as a public policy.** Owner: [ROLE] · Review cadence: quarterly and after material architecture changes.

## Purpose
Define and implement retention that is proportionate, lawful, documented, and consistent with the public Privacy Policy. The periods below must be decided from business/legal needs and verified against actual services; this document intentionally does not invent retention durations.

## Data inventory and decisions
For each category, record: purpose, system of record, owner, legal basis/need, retention trigger, retention duration, deletion mechanism, backup expiry, vendor copy handling, and evidence of successful deletion.

| Category | Systems to verify | Required decision |
|---|---|---|
| Account/profile | Google OAuth, Supabase Auth, profiles | Retention while account exists; deletion workflow |
| Conversations/messages | Supabase database, caches, logs | User deletion and account deletion behavior |
| Uploaded files/documents | Supabase Storage or other storage | Object deletion, derived text/embeddings, indexes |
| Saved artifacts/preferences | Database and caches | User controls and account deletion |
| Security/audit logs | Hosting, application, database | Minimum lawful period and access restrictions |
| Support records | Support mailbox/tool | Retention and restricted access |
| Billing records, if any | Payment/accounting providers | Applicable statutory recordkeeping |
| Backups | Database/storage backups | Expiry, restore-time deletion replay |
| AI/search vendors | Provider systems | Contractual retention and deletion capabilities |
| Analytics/diagnostics | Configured vendors | Retention, identifiers, opt-out/consent |

## Operational requirements
1. Implement a verified account-deletion workflow with re-authentication where appropriate.
2. Delete or unlink account-owned records in a controlled order that respects foreign keys and legal holds.
3. Delete stored objects and derived content, including extracted text, embeddings, caches, and search indexes where applicable.
4. Revoke sessions and credentials after account deletion.
5. Propagate deletion requests to vendors when supported and contractually required.
6. Document exceptions (e.g. records legally required to be retained), restrict access, and delete them when the exception ends.
7. Define backup expiry and a restore procedure that re-applies deletion records after restoring a backup.
8. Log deletion job status without copying the deleted content into the log.
9. Test partial failure, retries, duplicate requests, and ownership isolation.
10. Reconcile public policy statements with implementation before each release.

## Approval
Retention schedule approved by: [NAME/ROLE] · Legal review: [DATE] · Technical test evidence: [LINK] · Next review: [DATE]
