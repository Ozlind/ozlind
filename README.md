# OZLIND AI — UI Rebuild v3.1

This package is a production-oriented frontend refresh of the supplied OZLIND Next.js project.

## What changed

### Step 1 — Visual system
- Replaced the previous brown/charcoal palette with a midnight-indigo system.
- Added violet + mint accent lighting while keeping the OZLIND symbolic mark.
- Reworked spacing, typography, borders, shadows and responsive behavior.
- Removed emoji/character-based navigation icons in favor of accessible inline SVG icons.

### Step 2 — Workspace UI
- Premium desktop sidebar with Workspace, Recent conversations and profile areas.
- Mobile drawer navigation with scrim and Escape support.
- Cleaner top bar and conversation header.
- Four useful onboarding actions.
- Live/NEXT states for features that are and are not backed by the current API.

### Step 3 — AI controls
- Auto, Fast, Pro, Vision, Research and Create modes.
- Image creation continues through the existing `/api?action=image` endpoint.
- Vision/file understanding continues through the existing `/api` chat endpoint.
- Research continues through the existing `research` mode and source events.
- Provider/model names are intentionally not exposed in the UI.

### Step 4 — Conversation UX
- Streaming cursor and generating state.
- Stop generation.
- Copy with feedback.
- Edit user messages.
- Regenerate assistant responses.
- Delete individual messages.
- Clear current conversation.
- Local conversation history with automatic titles.
- Search and history expansion.
- `Ctrl + K` focuses conversation search.
- `N` starts a new conversation when the user is not typing.

### Step 5 — Preferences
- Conversation Memory On/Off. When Off, only the current user request is sent as conversational context.
- Custom instructions, stored locally on the device.
- Attachment chips for supported image/document/text formats.
- No client-side API keys.

## Important scope note

The current backend supplied with the project does not expose working endpoints for Photo Editor, Code Assistant, Documents or Voice AI. Those areas are therefore marked `NEXT` rather than pretending to be functional. The existing working Chat, Research, Image and Vision flows are preserved.

## Files changed

- `app/page.jsx` — complete frontend/workspace replacement.
- `app/globals.css` — complete visual-system replacement.
- `app/layout.jsx` — cleaned metadata and theme color.
- `BUILD_STEPS.md` — implementation checklist.

The supplied API route and environment structure are preserved.

## Verification

Run:

```bash
npm run verify
npm run build
```

`npm run verify` checks the required Next.js structure and prevents accidental public provider-key patterns.

If dependencies are already installed, `npm run build` should be the final deployment check before pushing to GitHub/Vercel.
