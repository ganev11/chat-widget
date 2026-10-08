// Branding. A theme is a flat object of colours and a few shapes; every key maps to one CSS
// variable on the widget's root, which the stylesheet reads (styles/tokens.css). A sportsbook
// passes only what differs from the preset it starts from:
//
//   SSTChat.init({ theme: { preset: 'light', primary: '#0a7d32', fontFamily: 'Roboto, sans-serif' } })

const VARS = {
    primary: '--cw-primary',            // brand colour: launcher, send button, CTAs, active tabs
    primaryHover: '--cw-primary-hover',
    onPrimary: '--cw-on-primary',       // text/icons on the brand colour
    background: '--cw-bg',              // chat panel background
    surface: '--cw-surface',            // cards (match, odds, betslip)
    surfaceAlt: '--cw-surface-alt',     // odds buttons, inputs, tiles inside cards
    surfaceHover: '--cw-surface-hover',
    border: '--cw-border',
    text: '--cw-text',
    textMuted: '--cw-text-muted',       // secondary text: markets, leagues, labels
    textSubtle: '--cw-text-subtle',     // tertiary text: captions, hints
    odds: '--cw-odds',                  // prices
    highlight: '--cw-highlight',        // acca accents, the player asked about, form bar
    accent: '--cw-accent',              // bet builder accents
    success: '--cw-success',            // wins, "added", confirmed lineup
    danger: '--cw-danger',              // losses, errors
    warning: '--cw-warning',            // predicted lineup, below-average ratings
    live: '--cw-live',                  // live match indicator
    userBubble: '--cw-user-bubble',     // the user's own messages
    userText: '--cw-user-text',
    headerBackground: '--cw-header-bg',
    headerText: '--cw-header-text',
    pitch: '--cw-pitch',                // lineups pitch
    radius: '--cw-radius',              // card corner radius
    fontFamily: '--cw-font',
};

// Light: a white sportsbook in red — the default.
const light = {
    primary: '#e30613',
    primaryHover: '#c10510',
    onPrimary: '#ffffff',
    background: '#f2f2f2',
    surface: '#ffffff',
    surfaceAlt: '#ececec',
    surfaceHover: '#e0e0e0',
    border: '#dedede',
    text: '#1a1a1a',
    textMuted: '#5c5c5c',
    textSubtle: '#8a8a8a',
    odds: '#1a1a1a',
    highlight: '#e30613',
    accent: '#1769d1',
    success: '#2f9e44',
    danger: '#d92d20',
    warning: '#c27803',
    live: '#e30613',
    userBubble: '#e30613',
    userText: '#ffffff',
    headerBackground: '#ffffff',
    headerText: '#1a1a1a',
    pitch: '#3c8d4f',
    radius: '10px',
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};

// Dark: the SSTrader app's look.
const dark = {
    primary: '#368b54',
    primaryHover: '#2d7446',
    onPrimary: '#ffffff',
    background: '#1b1b1c',
    surface: '#232325',
    surfaceAlt: '#18181a',
    surfaceHover: '#2e2e31',
    border: '#4d4d4f',
    text: '#f3f4f6',
    textMuted: '#9ca3af',
    textSubtle: '#6b7280',
    odds: '#f1cb22',
    highlight: '#f1cb22',
    accent: '#7dd3fc',
    success: '#34d399',
    danger: '#f87171',
    warning: '#fbbf24',
    live: '#ef4444',
    userBubble: '#2b4a36',
    userText: '#ffffff',
    headerBackground: '#232325',
    headerText: '#f3f4f6',
    pitch: '#2b3a2f',
    radius: '8px',
    fontFamily: "'Source Sans Pro', system-ui, sans-serif",
};

export const presets = { light, dark };

// Full theme: the preset (default light) with the caller's overrides.
export function resolveTheme(theme = {}) {
    const { preset = 'light', ...overrides } = theme;
    const base = presets[preset] ?? light;
    const out = { ...base };
    for (const [k, v] of Object.entries(overrides)) if (k in VARS && v != null && v !== '') out[k] = String(v);
    return out;
}

// The theme as an inline style of CSS variables: { '--cw-primary': '#e30613', … }.
export function themeStyle(theme) {
    const t = resolveTheme(theme);
    return Object.fromEntries(Object.entries(VARS).map(([k, name]) => [name, t[k]]));
}
