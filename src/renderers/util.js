// Small helpers shared by the renderers. Items are the SSTrader API's own rows, read as they are.

export const price = (v) => (typeof v === 'number' ? v.toFixed(2) : v);
export const side = (fixture, loc) => fixture?.participants?.find((p) => p.location === loc);
export const matchName = (f) => `${side(f, 'home')?.name ?? '?'} vs ${side(f, 'away')?.name ?? '?'}`;

// Dates in the widget's locale, the viewer's time zone.
const format = (locale, iso, opts) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString(locale, opts); } catch { return new Date(iso).toLocaleString(undefined, opts); }
};
export const kickoff = (locale, iso) => format(locale, iso, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const timeOf = (locale, iso) => format(locale, iso, { hour: '2-digit', minute: '2-digit' });
export const dayOf = (locale, iso) => format(locale, iso, { weekday: 'short', day: 'numeric', month: 'short' });
export const shortDay = (locale, iso) => format(locale, iso, { day: 'numeric', month: 'short' });

export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
