# Ozlind Frontend Rebuild Roadmap

**Status:** Active plan  
**Scope:** Frontend only, preserving existing backend behavior and data contracts.  
**Branch:** `frontend/world-class-rebuild`

## Product quality bar

Ozlind should feel like a crafted, dependable AI workspace—not a generic chatbot template. Every interactive control must have a clear purpose, usable feedback, keyboard support where applicable, and a sensible mobile layout.

## Non-negotiable boundaries

- Preserve Supabase Auth, Google OAuth, session handling, RLS, API route contracts, and existing database schemas.
- Do not move server-only credentials into client code or change environment variable names without verifying Vercel configuration.
- Reuse Ozlind's existing SVG icon sprite and primary mark; do not substitute unrelated icon artwork.
- Do not add decorative controls that do not work. A feature is not complete until its loading, success, empty, error, and disabled states are considered.
- Make changes on this feature branch, run available checks, and review deployment status before describing a release as successful.

## Stages

### 1. Audit and visual foundation
- Inventory routes, reusable components, existing CSS cascade, preferences, icon assets, and responsive breakpoints.
- Consolidate visual tokens for surfaces, text, borders, focus rings, spacing, radii, motion, and semantic feedback.
- Establish a restrained visual direction with coherent light and dark themes.
- Verify narrow screens, safe areas, reduced motion, keyboard focus, and horizontal overflow.

**Exit criteria:** no auth/API/database changes; theme tokens agree with defaults; baseline checks pass.

### 2. App shell and navigation
- Refine sidebar hierarchy, mobile drawer behavior, current-route states, conversation search, and workspace navigation.
- Add a command palette and keyboard shortcuts only when their actions are fully implemented.
- Make navigation states accessible and predictable.

**Exit criteria:** all navigation targets resolve; mobile drawer opens/closes safely; keyboard and focus behavior are verified.

### 3. Chat interaction
- Refine message hierarchy, streaming feedback, composer layout, model controls, web-search state, image attachments, and message actions.
- Keep Auto and Web Search visible by default; reveal Fast, Vision, and Pro under Auto.
- Preserve send, stop, regenerate, retry, history loading, and offline handling.
- Improve Markdown, code blocks, copy feedback, and long-content wrapping.

**Exit criteria:** existing API contracts remain intact; chat actions are tested in success, failure, offline, and interrupted states.

### 4. Workspace and productivity
- Improve saved artifacts, presets, documents, settings, and search.
- Add polished create/edit/delete flows, confirmation, empty states, and optimistic UI only where rollback is reliable.
- Add useful export/copy actions and user-controlled customization.

**Exit criteria:** each CRUD action is connected to its existing endpoint and errors are recoverable.

### 5. Accessibility, responsiveness, and performance
- Audit semantic HTML, labels, focus order, contrast, reduced motion, tap targets, and screen-reader status messages.
- Verify mobile viewport behavior, safe-area padding, overflow, image sizing, and composer visibility.
- Avoid unnecessary client work and large dependencies.

**Exit criteria:** no known blocking accessibility or mobile-layout regressions.

### 6. Verification and release
- Run typecheck, lint, architecture checks, production build, and targeted interaction tests.
- Review diffs for backend/auth/config changes and accidental secrets.
- Deploy through the existing Vercel/GitHub integration; inspect the actual deployment result and smoke-test critical routes.

**Exit criteria:** checks pass, preview is reviewed, authentication and chat smoke tests pass, and production deployment status is explicitly confirmed.

## Working loop

For every stage: **Inspect → Implement → Test → Fix → Review diff → Commit → Verify deployment**. Do not proceed past a stage with a known critical failure.
