# OZLIND Image Generation V1 — Integration Guide

This package is deliberately isolated from the existing chat engine.

## Files to add

1. `image-generator.js` → root
2. `api/image-generate.js` → `api/`
3. `image-generator-ui.html` → HTML block to paste into `index.html`
4. `image-generator.css` → append to the end of `style.css`

## Existing files that should NOT be replaced

- `chatbot.js`
- `api/chat.js`
- boot experience in `index.html`

The current repository already has a working chat/streaming architecture. A professional product should avoid touching that code just to add an independent creation tool.

## index.html changes

### 1. Image Generator navigation

Find the existing sidebar item that currently says:

`Image Generator` / `NEXT`

Change its view target from whatever placeholder it currently uses to:

`data-view="image"`

Keep its `NEXT` badge only if you want the feature visually marked as beta/early access. If you consider the generator V1-ready, remove the `NEXT` badge.

### 2. Add the page

Paste the complete contents of `image-generator-ui.html`'s `<section ...>` block into `index.html` alongside the other `.page` sections.

### 3. Script

Add:

`<script src="image-generator.js" defer></script>`

near the existing `chatbot.js` script.

## style.css

Append the complete contents of `image-generator.css`.

## Important size note

The backend only accepts these combinations:

- 512 × 512
- 768 × 768
- 1024 × 1024
- 1024 × 768
- 768 × 1024
- 1536 × 1024
- 1024 × 1536

The simple V1 UI uses independent width/height selects, so an invalid combination is safely normalized by the API to 1024 × 1024.

For a later V1.1 pass, replace those two selects with an explicit Aspect Ratio control. That is cleaner UX.

## API key / login

No new API key is required for this Pollinations-based prototype.

Do not add a Pollinations secret to `.env`.

## Architecture

OZLIND UI
  ↓
image-generator.js
  ↓
POST /api/image-generate
  ↓
provider URL
  ↓
Pollinations

This keeps image generation separate from:

`POST /api/chat`

That separation is intentional and makes future provider replacement much easier.

## Why this is not merged into chatbot.js

The existing `chatbot.js` already owns:

- chat state
- history
- streaming
- research
- vision attachments
- settings
- message actions
- local persistence

Adding image-generation state to that file would increase coupling and regression risk.

## Before calling this production-ready

V1 should later add:

- provider health/timeout handling
- authenticated usage limits
- generation history in Supabase
- server-side image proxy/storage
- stronger abuse/rate-limit controls
- explicit aspect-ratio presets
- prompt presets
- image variation/remix
- delete/download/share actions
