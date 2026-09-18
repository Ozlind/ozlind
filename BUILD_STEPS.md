# OZLIND UI REBUILD — STEP-BY-STEP PACKAGE

## Phase 01 — Inspect
Source package inspected before editing:
- Next.js App Router structure
- Existing client chat state
- SSE streaming protocol
- Existing image endpoint
- Existing research/source events
- Existing attachment format
- Existing localStorage history/settings
- Existing verification script

## Phase 02 — Rebuild the frontend
`app/page.jsx` is the complete frontend replacement.

It keeps the existing API contract:
- `POST /api`
- `POST /api?action=image`

No provider/model names are rendered to users.

## Phase 03 — Replace the design system
`app/globals.css` is the complete style replacement.

New direction:
- Midnight / indigo foundation
- Electric violet primary accent
- Mint status accent
- Dense premium dashboard spacing
- Mobile-first drawer behavior
- Reduced visual noise
- Accessible focus states
- Reduced-motion support

## Phase 04 — Preserve real capabilities
The frontend exposes only functionality already connected to the supplied backend:
- AI Chat
- Web Research
- Image Studio / generation
- Vision + supported attachments

Unimplemented product areas are explicitly marked `NEXT`.

## Phase 05 — Local UX
Implemented:
- local history
- automatic conversation titles
- search
- custom instructions
- conversation-memory toggle
- copy/edit/delete/regenerate
- stop generation
- attachment removal
- responsive navigation
- keyboard shortcuts

## Phase 06 — Verification
Run from the project root:

1. `npm install`
2. `npm run verify`
3. `npm run build`
4. `npm run start`

Then verify on mobile and desktop before deploying to Vercel.

## Phase 07 — GitHub/Vercel
For a phone-only workflow:
1. Open the GitHub repository.
2. Replace `app/page.jsx`.
3. Replace `app/globals.css`.
4. Replace `app/layout.jsx`.
5. Keep the supplied `app/api/route.js`.
6. Commit the files.
7. Wait for Vercel to build the new commit.
8. Open the deployment and test Chat, Research, Create, Vision, history and settings.

## Production rule
Do not add fake backend functionality to the NEXT modules. When their real APIs are ready, they can be connected without redesigning this shell.
