/**
 * Ozlind's shared design contract.
 *
 * CSS custom properties in src/styles/theme.css are the runtime source of truth.
 * Keep component styling semantic: use these tokens instead of one-off colors,
 * spacing values, shadows, and border radii.
 */
export const designTokens = {
  spacing: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
    16: "64px",
  },
  radius: {
    xs: "var(--radius-xs)",
    sm: "var(--radius-sm)",
    control: "var(--radius)",
    card: "var(--radius-lg)",
    panel: "var(--radius-xl)",
    pill: "var(--radius-pill)",
  },
  colors: {
    background: "var(--bg)",
    surface: "var(--surface)",
    elevatedSurface: "var(--surface-elevated)",
    subtleSurface: "var(--surface-subtle)",
    border: "var(--border)",
    strongBorder: "var(--border-strong)",
    text: "var(--text)",
    mutedText: "var(--text-muted)",
    subtleText: "var(--text-subtle)",
    accent: "var(--accent)",
    accentHover: "var(--accent-hover)",
    accentForeground: "var(--accent-fg)",
    danger: "var(--danger)",
    success: "var(--success)",
    warning: "var(--warning)",
    info: "var(--info)",
  },
  elevation: {
    subtle: "var(--shadow-sm)",
    raised: "var(--shadow-md)",
  },
  interaction: {
    focusRing: "var(--focus-ring)",
    fastMotion: "var(--motion-fast)",
    normalMotion: "var(--motion-normal)",
    minimumTouchTarget: "44px",
  },
  breakpoints: {
    mobile: "380px",
    tablet: "768px",
  },
} as const;

export type DesignTokens = typeof designTokens;
