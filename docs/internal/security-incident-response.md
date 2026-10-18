# Internal Runbook: Security Incident Response

**Internal only. Do not publish operational security details.** Incident lead: [ROLE/CONTACT] · Last tested: [DATE]

## Severity
- **SEV-1:** confirmed or likely exposure of user content/credentials, broad account takeover, critical production compromise, or major outage with security impact.
- **SEV-2:** limited unauthorized access, exploitable high-impact vulnerability, or sustained abuse.
- **SEV-3:** contained suspicious activity or low-impact security defect.
Adjust these definitions to the team's actual operating model.

## Response sequence
1. **Triage:** record discovery time, affected systems, evidence source, initial scope, and incident lead.
2. **Contain:** revoke/rotate compromised credentials; disable affected routes/tokens; restrict access or isolate affected service. Avoid destructive changes that erase evidence.
3. **Preserve evidence:** retain relevant logs securely with access controls and timestamps. Do not copy unnecessary user content into tickets.
4. **Assess impact:** determine data categories, users, jurisdictions, time window, persistence, vendor involvement, and whether exfiltration is evidenced or merely suspected.
5. **Notify:** legal/privacy lead decides applicable user, regulator, CERT-In, contractual, and vendor notifications and deadlines. Record decision rationale and timestamps. Never assume a universal deadline.
6. **Remediate:** patch root cause, rotate secrets, invalidate sessions where needed, close exploit paths, and add regression tests.
7. **Recover:** restore service gradually; verify authentication, RLS, data integrity, and monitoring.
8. **Communicate:** provide accurate, timely information through approved channels; do not speculate or conceal material facts.
9. **Review:** perform a blameless postmortem with timeline, root cause, impact, detection gap, corrective actions, owners, and due dates.

## Ozlind-specific checks
- Supabase Auth/OAuth sessions, callback URLs, RLS policies, service-role key exposure.
- Vercel deployment/env-var changes and logs.
- AI provider requests, uploads, prompt/context leakage.
- Cross-user access to conversations, documents, artifacts, and storage.
- Dependency supply-chain and GitHub token exposure.
- Usage spikes, automated abuse, unexpected outbound requests.

## Evidence checklist
- [ ] Incident ticket and severity
- [ ] Incident lead and decision log
- [ ] Timeline and affected deployments
- [ ] Credential rotation/revocation record
- [ ] Scope and data-impact assessment
- [ ] Legal/regulatory notification assessment
- [ ] Recovery verification
- [ ] Postmortem and assigned actions

Keep this runbook and detailed incident records access-controlled. Review and tabletop-test at least annually and after major architecture changes.
