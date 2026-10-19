# Ozlind Repository Structure

**Status:** Current repository map and incremental refactoring guide  
**Stack:** Next.js App Router, React, TypeScript, Vercel AI SDK, Supabase, Vercel

This document describes the files that currently exist in the repository. Proposed future layers are explicitly marked as future work; a folder diagram must not be mistaken for implemented functionality.

## Current repository tree

```text
ozlind/
├── .github/workflows/ci.yml
├── docs/
│   ├── adr/                      # Accepted design decisions
│   ├── architecture/project-structure.md
│   ├── audits/                   # Dated repository/security reviews
│   ├── internal/                 # Internal operations/security runbooks
│   └── legal/                    # Draft policies; not published routes
├── public/
│   ├── ozlind-icons.svg
│   └── ozlind-mark.svg
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── artifacts/route.ts
│   │   │   ├── chat/route.ts
│   │   │   ├── documents/route.ts
│   │   │   ├── health/route.ts
│   │   │   ├── preferences/route.ts
│   │   │   ├── presets/route.ts
│   │   │   ├── ready/route.ts
│   │   │   └── research/route.ts
│   │   ├── app/
│   │   │   ├── [conversationId]/page.tsx
│   │   │   ├── documents/page.tsx
│   │   │  ���q�^