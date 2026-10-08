// The renderers on their own — for a client that builds its own chat shell (e.g. the SSTrader
// app and its back office) but draws answers exactly as the widget does. They need:
//   - the theme's CSS variables on an ancestor (themeStyle(theme) as its style),
//   - Tailwind v4 compiling their classes (@import the package's tokens.css, @source its src/),
//   - optionally an I18nContext provider (createI18n) — English without one.
export { ChatItems, ChatItem, visibleItems } from './ChatItems.jsx';
export { Markdown } from './Markdown.jsx';
export { I18nContext, createI18n, languages } from '../i18n/index.js';
export { themeStyle, resolveTheme, presets } from '../theme.js';
