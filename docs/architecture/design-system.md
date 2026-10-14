# Ozlind Core App & Design System

## Product principles

Ozlind is a calm, mobile-first AI workspace. It should feel deliberate and useful rather than like a generic chatbot template. Visual refactors must preserve authentication, chat API contracts, saved data, and Supabase policies.

## Visual foundations

The source of truth for global tokens is `src/styles/theme.css`.

- **Canvas:** warm near-white in light mode; deep charcoal in dark mode.
- **Brand accent:** restrained terracotta, used for primary actions and meaningful emphasis.
- **Typography:** system-first sans serif for interface text; serif reserved for editorial moments.
- **Layout:** 4px spacing rhythm, readable conversation width, stable sidebar and topbar sizing.
- **Shape:** modest radii and subtle elevation. Avoid decorative gradients and stacked cards.
- **Motion:** short transitions; honor `prefers-reduced-motion`.

## Component boundaries

- Reusable primitives: `src/components/ui`.
- App framing and navigation: `src/components/layout`.
- Chat interactions: `src/components/chat`.
- Route handlers and server-only logic stay under `src/app/api` and `src/lib`.
- Never expose server secrets to client components.
- Interactive elements need semantic controls, visible keyboard focus, accessible names, and working actions.
- Prefer shared tokens over hard-coded colors, shadows, and radii.

## Responsive rules

- Mobile is the baseline; page-level horizontal overflow must remain zero.
- Respect device safe areas for fixed navigation and the composer.
- Mobile navigation must open and close accessibly without trapping focus unexpectedly.
- Long code and URLs should wrap or scroll inside their own region rather than widening the page.

## Release checklist

1. Preserve Supabase Auth, Google OAuth callback behavior, API request/response shapes, and current environment variable names.
2. Run `npm run typecheck`, `npm run lint`, `npm run verify:architecture`, and `npm run build`.
3. Test light/dark themes, keyboard focus, reduced motion, narrow viewports, empty/loading/error states, and chat send/cancel behavior.
4. Check the Vercel preview before merging. A successful build alone does not prove live auth or AI provider integrations work.
