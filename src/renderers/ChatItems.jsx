/** @jsxImportSource preact */
// Renders the chat response's `ui` items. Each item is { ref, kind, data, source }; `data` is the
// SSTrader API's own rows (fixture incl. `integration`, odds incl. `raw`), so every view here
// reads API fields directly. CTAs call onAction({ action, ... }) — the host site acts on it (adds
// selections to its betslip, opens its event page); the chat never sees the host's betslip.
//
//   add_to_betslip   { selections: [odd] }                 one or more selections, each with `raw`
//   add_bet_builder  { bet_builder, fixture }               a priced bet builder (bet_builder.raw)
//   open_event       { fixture, integration, fixture_id }   the match on the host's own site
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useI18n } from '../i18n/index.js';
import { FixtureCard } from './FixtureCard.jsx';
import { Form } from './Form.jsx';
import { Lineups } from './Lineups.jsx';
import { MatchStats, Timeline } from './MatchStats.jsx';
import { Predictions } from './Predictions.jsx';
import { kickoff, matchName, price, reducedMotion } from './util.js';

const Card = ({ title, subtitle, children, footer }) => (
    <div className="rounded-cw border border-cw-border bg-cw-surface overflow-hidden">
        {(title || subtitle) && (
            <div className="px-3 py-2 border-b border-cw-border">
                {title && <div className="text-sm font-semibold text-cw-text">{title}</div>}
                {subtitle && <div className="text-xs text-cw-muted">{subtitle}</div>}
            </div>
        )}
        <div className="px-3 py-2">{children}</div>
        {footer && <div className="px-3 py-2 border-t border-cw-border">{footer}</div>}
    </div>
);

const Cta = ({ children, onClick }) => (
    <button type="button" onClick={onClick}
        className="w-full px-3 py-1.5 rounded bg-cw-primary hover:bg-cw-primary-hover text-cw-on-primary text-sm font-semibold">
        {children}
    </button>
);

function OddChip({ data, onAction }) {
    const { t } = useI18n();
    return (
        <Card title={`${data.label_name} @ ${price(data.value)}`} subtitle={data.market_name}
            footer={<Cta onClick={() => onAction({ action: 'add_to_betslip', selections: [data] })}>{t('addToBetslip')}</Cta>}>
            <div className="text-xs text-cw-muted">{data.market_description}</div>
        </Card>
    );
}

// A suspended selection (the chat sends one only to complete its market) is drawn locked.
const Lock = () => (
    <svg viewBox="0 0 16 16" className="w-3 h-3 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M4 7V5a4 4 0 1 1 8 0v2h.5A1.5 1.5 0 0 1 14 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5v-5A1.5 1.5 0 0 1 3.5 7H4Zm2 0h4V5a2 2 0 1 0-4 0v2Z" />
    </svg>
);

function OddButton({ o, onAction, label = true }) {
    const { t } = useI18n();
    return (
        <button type="button" title={o.suspend ? t('suspended') : t('addToBetslip')} disabled={!!o.suspend}
            onClick={() => onAction({ action: 'add_to_betslip', selections: [o] })}
            className={`flex-1 min-w-0 flex ${label ? 'justify-between' : 'justify-center'} items-center gap-2 px-2 py-1.5 rounded bg-cw-surface-alt text-xs ${o.suspend ? 'opacity-60' : 'hover:bg-cw-surface-hover'}`}>
            {label && <span className="text-cw-muted truncate">{o.label_name}</span>}
            {o.suspend
                ? <span className="flex items-center gap-1 text-cw-subtle"><Lock />{price(o.value)}</span>
                : <span className="text-cw-odds font-bold tabular-nums">{price(o.value)}</span>}
        </button>
    );
}

// "Over 9.5" on line 9.5 → "Over": the line has its own column.
const withoutLine = (label, line) => String(label ?? '').replace(new RegExp(String.raw`\s*(?<![\d.])\(?[+-]?${String(Math.abs(line)).replace('.', '\\.')}\)?$`), '');

// A line market as one row per line, sorted by line, each side under its own column. The main
// line (the pair with the closest prices) is marked.
function LineMarket({ rows, onAction }) {
    const { t } = useI18n();
    const overFirst = (o) => (/^over\b/i.test(o.label_name) ? 0 : /^under\b/i.test(o.label_name) ? 1 : 0.5);
    const byLine = new Map();
    for (const o of rows) {
        const k = Number(o.line);
        if (!byLine.has(k)) byLine.set(k, []);
        byLine.get(k).push(o);
    }
    const lines = [...byLine.entries()].sort((a, b) => a[0] - b[0])
        .map(([line, os]) => ({ line, os: [...os].sort((a, b) => overFirst(a) - overFirst(b) || a.label_id - b.label_id) }));
    const gap = (os) => (os.length === 2 ? Math.abs(os[0].value - os[1].value) : Infinity);
    const main = lines.reduce((m, l) => (gap(l.os) < gap(m.os) ? l : m), lines[0]).line;
    // Shared column headings when every line has the same sides once the line is taken out.
    const sides = (l) => l.os.map((o) => withoutLine(o.label_name, l.line)).join('|');
    const heads = lines.every((l) => sides(l) === sides(lines[0])) ? lines[0].os.map((o) => withoutLine(o.label_name, lines[0].line)) : null;

    return (
        <div className="space-y-1">
            {heads && (
                <div className="flex gap-1 text-[10px] uppercase tracking-wide text-cw-subtle">
                    <span className="w-12 shrink-0">{t('line')}</span>
                    {heads.map((h) => <span key={h} className="flex-1 text-center">{h}</span>)}
                </div>
            )}
            {lines.map((l) => (
                <div key={l.line} className={`flex items-center gap-1 rounded ${l.line === main ? 'ring-1 ring-cw-highlight/50' : ''}`}>
                    <span className={`w-12 shrink-0 pl-1.5 text-xs tabular-nums ${l.line === main ? 'text-cw-text font-semibold' : 'text-cw-muted'}`}>{l.line}</span>
                    {l.os.map((o) => <OddButton key={o.odd_id} o={o} onAction={onAction} label={!heads} />)}
                </div>
            ))}
        </div>
    );
}

// Layout by market_id, as the SSTrader fixture page does: a market without a line still carries
// `line: 0`, so the field alone cannot tell them apart.
const LINE_MARKET_IDS = new Set([2, 3, 4, 5, 6, 12, 13, 14, 16, 203]); // Asian handicap, over/under
// Selection order by label_id where it is not the natural one (home, draw, away).
const SELECTION_ORDER = { 1: [1, 0, 2], 11: [1, 0, 2], 22: [1, 0, 2], 58: [10, 12, 2] };

// A market of up to three selections as one row: each label above its price.
function RowMarket({ rows, onAction }) {
    return (
        <div className="space-y-0.5">
            <div className="flex gap-1 text-[10px] uppercase tracking-wide text-cw-subtle">
                {rows.map((o) => <span key={o.odd_id} className="flex-1 min-w-0 text-center truncate">{o.label_name}</span>)}
            </div>
            <div className="flex gap-1">
                {rows.map((o) => <OddButton key={o.odd_id} o={o} onAction={onAction} label={false} />)}
            </div>
        </div>
    );
}

function OddsTable({ data, onAction }) {
    const { t } = useI18n();
    const markets = new Map();
    for (const o of data.rows ?? []) {
        if (!markets.has(o.market_name)) markets.set(o.market_name, []);
        markets.get(o.market_name).push(o);
    }
    const ordered = (rows) => {
        const order = SELECTION_ORDER[rows[0]?.market_id];
        const rank = (o) => (order ? (order.indexOf(o.label_id) + 1 || order.length + 1) : 0);
        return [...rows].sort((a, b) => rank(a) - rank(b) || a.label_id - b.label_id);
    };
    return (
        <Card title={t('odds')} subtitle={data.odds_type?.replace('_', '-')}>
            <div className="space-y-3">
                {[...markets.entries()].map(([name, rows]) => (
                    <div key={name}>
                        <div className="text-xs text-cw-muted mb-1">{name}</div>
                        {LINE_MARKET_IDS.has(rows[0].market_id)
                            ? <LineMarket rows={rows} onAction={onAction} />
                            : rows.length <= 3
                                ? <RowMarket rows={ordered(rows)} onAction={onAction} />
                                : (
                                    <div className="grid grid-cols-2 @md:grid-cols-3 gap-1">
                                        {ordered(rows).map((o) => <OddButton key={o.odd_id} o={o} onAction={onAction} />)}
                                    </div>
                                )}
                    </div>
                ))}
            </div>
        </Card>
    );
}

// Brief "added" tick on a button after a click: the chat cannot see the host's betslip, so it
// confirms the click rather than claiming a state it does not know.
function useFlash() {
    const [on, setOn] = useState(null);
    const flash = (key) => {
        setOn(key);
        setTimeout(() => setOn((k) => (k === key ? null : k)), 1500);
    };
    return [on, flash];
}

const Tick = () => (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <path d="M3 8.5l3 3 7-7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
);

// --- Slot-machine reveal -------------------------------------------------------------------------
// A slip that arrives with a fresh answer is revealed like a slot machine: every leg spins as a
// blurred reel of decoy picks and prices, then the legs stop one after another, the total odds
// climbing as each lands. A slip from history, or with reduced motion, is drawn at once. Clicking
// the card while it spins skips to the end. The real rows stay laid out (invisible) under the
// reels, so the card never changes size.

const FIRST_STOP = 900;   // ms until the first leg lands
const STOP_GAP = 600;     // between legs
const LAST_STOP = 1000;   // the last leg keeps you waiting a little longer
const DECOY_PICKS = ['Over 2.5', 'Under 2.5', 'BTTS', '1', 'X', '2', 'Over 9.5', 'Anytime', '1X', 'Under 4.5', 'Yes', 'No'];

const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(([, v]) => v);
const decoyPrices = (n) => Array.from({ length: n }, () => (1.15 + Math.random() ** 2 * 6).toFixed(2));

// How many of `count` legs have landed. `delay` (ms) staggers several slips in one answer;
// null/undefined means no reveal.
function useReelReveal(count, delay) {
    const [animate] = useState(() => delay != null && count > 0 && !reducedMotion());
    const [landed, setLanded] = useState(animate ? 0 : count);
    useEffect(() => {
        if (landed >= count) return undefined;
        const wait = landed === 0 ? FIRST_STOP + delay : landed === count - 1 ? LAST_STOP : STOP_GAP;
        const id = setTimeout(() => setLanded((n) => n + 1), wait);
        return () => clearTimeout(id);
    }, [landed, count]);
    return { animate, landed, spinning: landed < count, skip: () => setLanded(count) };
}

// Decoys for each leg's reel, drawn from the slip's own picks so the blur looks like the real thing.
function useReels(legs) {
    return useMemo(() => {
        const words = legs.map((o) => o.raw?.player_name ?? o.label_name).filter(Boolean);
        return legs.map(() => ({
            words: shuffle([...words, ...DECOY_PICKS]).slice(0, 8),
            prices: decoyPrices(8),
            speed: 0.3 + Math.random() * 0.15,
        }));
    }, [legs.length]);
}

const Reel = ({ items, speed, className = '' }) => (
    <div className="reel-window absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className={`reel-strip ${className}`} style={{ animationDuration: `${speed}s` }}>
            {[...items, ...items].map((x, i) => <div key={i} className="h-6 leading-6 truncate">{x}</div>)}
        </div>
    </div>
);

// One leg of a slip: a dot on the spine joining it to the next, the pick, its market and an
// optional line under it, and its own price - a button that adds just this selection.
// A player leg names the player: its label alone only says "Anytime".
// `reel` (only while a slip is being revealed) is { spinning, words, prices, speed }.
function Leg({ o, sub, last, added, onAdd, dot = 'bg-cw-highlight ring-cw-highlight/20', reel }) {
    const { t } = useI18n();
    const player = o.raw?.player_name;
    const spinning = !!reel?.spinning;
    const land = reel && !spinning ? 'reel-land' : '';
    return (
        <li className={`relative -mx-1.5 px-1.5 rounded flex gap-3 py-1.5 ${land && 'reel-flash'}`}>
            <span className="relative w-4 shrink-0 flex justify-center">
                <span className={`mt-1.5 w-2 h-2 rounded-full ring-2 transition-colors ${spinning ? 'bg-cw-subtle ring-cw-subtle/20' : dot}`} />
                {!last && <span className="absolute top-4 -bottom-3 w-px bg-cw-border" />}
            </span>
            <div className="relative flex-1 min-w-0 overflow-hidden">
                <div className={spinning ? 'invisible' : land}>
                    <div className="text-sm text-cw-text font-medium truncate">{player ?? o.label_name}</div>
                    <div className="text-[11px] text-cw-muted truncate">{player ? `${o.label_name} · ${o.market_name}` : o.market_name}</div>
                    {sub && <div className="text-[11px] text-cw-subtle truncate">{sub}</div>}
                </div>
                {spinning && <Reel items={reel.words} speed={reel.speed} className="text-sm font-medium text-cw-muted" />}
            </div>
            <div className="relative self-center shrink-0 overflow-hidden rounded">
                <button type="button" title={t('addSelection')} onClick={onAdd} disabled={spinning}
                    className={`min-w-14 flex items-center justify-center rounded px-2 py-1 text-sm font-bold tabular-nums transition-colors ${added ? 'bg-cw-success text-white' : 'bg-cw-surface-alt text-cw-odds hover:bg-cw-surface-hover'} ${spinning ? 'invisible' : land}`}>
                    {added ? <Tick /> : price(o.value)}
                </button>
                {spinning && (
                    <div className="absolute inset-0 rounded bg-cw-surface-alt">
                        <Reel items={reel.prices} speed={reel.speed * 0.8} className="text-center text-sm font-bold tabular-nums text-cw-odds" />
                    </div>
                )}
            </div>
        </li>
    );
}

// While spinning, a click anywhere on the card skips the reveal.
function SlipCard({ children, reveal }) {
    const { t } = useI18n();
    return (
        <div onClick={reveal?.spinning ? reveal.skip : undefined} title={reveal?.spinning ? t('clickToReveal') : undefined}
            className={`rounded-cw border bg-cw-surface overflow-hidden transition-colors duration-500 ${reveal?.spinning ? 'border-cw-highlight/60 cursor-pointer' : 'border-cw-border'}`}>
            {children}
        </div>
    );
}

// `rolling` spins the price as a reel; `pop` bumps it each time the value changes.
const SlipPrice = ({ label, value, className = 'text-cw-odds', rolling, pop }) => (
    <div className="shrink-0 text-right leading-none">
        <div className="text-[10px] uppercase tracking-wide text-cw-subtle">{label}</div>
        <div className={`relative mt-0.5 text-lg font-bold tabular-nums ${className}`}>
            {rolling
                ? <><span className="invisible">{price(value)}</span><Reel items={rolling} speed={0.35} className="text-right" /></>
                : <span key={price(value)} className={pop ? 'reel-pop' : ''}>{price(value)}</span>}
        </div>
    </div>
);

const SlipCta = ({ done, children, doneText, value, onClick, disabled }) => (
    <div className="px-3 pb-3 pt-1">
        <button type="button" onClick={onClick} disabled={disabled}
            className={`w-full flex items-center justify-between rounded px-3 py-2 text-sm font-semibold transition-all ${done ? 'bg-cw-success text-white' : 'bg-cw-primary text-cw-on-primary'} ${disabled ? 'opacity-40' : done ? '' : 'hover:bg-cw-primary-hover'}`}>
            <span className="flex items-center gap-1.5">{done && <Tick />}{done ? doneText : children}</span>
            <span className="font-bold tabular-nums">{disabled ? '…' : price(value)}</span>
        </button>
    </div>
);

// An acca as a ticket: each leg is its own single (its price adds just that selection), the
// legs joined down the left like a slip, and the combined price on top and on the CTA.
// While revealing, the total climbs as the product of the legs landed so far, then settles on the
// slip's own total_odds once the last one lands.
function Acca({ data, onAction, reveal }) {
    const { t, locale } = useI18n();
    const [added, flash] = useFlash();
    const sels = data.legs.map((l) => l.selection);
    const r = useReelReveal(sels.length, reveal);
    const reels = useReels(sels);
    const totalReel = useMemo(() => decoyPrices(8), []);
    const total = r.spinning ? sels.slice(0, r.landed).reduce((p, o) => p * Number(o.value), 1) : data.total_odds;
    const add = (key, selections) => {
        onAction({ action: 'add_to_betslip', selections });
        flash(key);
    };
    return (
        <SlipCard reveal={r.animate && r}>
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-cw-border">
                <div className="flex items-center gap-2">
                    <span className="rounded bg-cw-highlight/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-cw-highlight">{t('acca')}</span>
                    <span className="text-xs text-cw-muted">{r.spinning ? t('legsLanded', { landed: r.landed, n: sels.length }) : t('legs', { n: sels.length })}</span>
                </div>
                <SlipPrice label={t('totalOdds')} value={r.animate && r.landed === 0 ? data.total_odds : total}
                    rolling={r.animate && r.landed === 0 && totalReel} pop={r.animate} />
            </div>
            <ol className="px-3 py-1">
                {data.legs.map((l, i) => (
                    <Leg key={l.selection.odd_id} o={l.selection} last={i === data.legs.length - 1}
                        sub={`${matchName(l.fixture)} · ${kickoff(locale, l.fixture.date_time)}`}
                        reel={r.animate ? { ...reels[i], spinning: i >= r.landed } : undefined}
                        added={added === l.selection.odd_id} onAdd={() => add(l.selection.odd_id, [l.selection])} />
                ))}
            </ol>
            <SlipCta done={added === 'all'} doneText={t('addedToBetslip')} value={data.total_odds} disabled={r.spinning}
                onClick={() => add('all', sels)}>{t('addAcca')}</SlipCta>
        </SlipCard>
    );
}

// A bet builder: several picks from ONE match priced as a single bet by the sportsbook - not the
// product of the legs, which are correlated. The match leads; each leg can still go on the slip as
// a single, and the CTA adds the builder itself (add_bet_builder, priced by its `raw`).
// Its price is not a product of the legs, so while revealing it rolls until the last leg lands.
function BetBuilder({ data, onAction, reveal }) {
    const { t, locale } = useI18n();
    const [added, flash] = useFlash();
    const bb = data.bet_builder;
    const f = data.fixture;
    const legs = bb.selections ?? [];
    const r = useReelReveal(legs.length, reveal);
    const reels = useReels(legs);
    const priceReel = useMemo(() => decoyPrices(8), []);
    const single = (o) => {
        onAction({ action: 'add_to_betslip', selections: [o] });
        flash(o.odd_id);
    };
    return (
        <SlipCard reveal={r.animate && r}>
            <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-cw-border">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="rounded bg-cw-accent/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-cw-accent">{t('betBuilder')}</span>
                        <span className="text-xs text-cw-muted">{t('picks', { n: legs.length })}</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-cw-text truncate">{matchName(f)}</div>
                    <div className="text-[11px] text-cw-muted truncate">{f?.league?.name ? `${f.league.name} · ` : ''}{kickoff(locale, f?.date_time)}</div>
                </div>
                <SlipPrice label={t('odds')} value={bb.value} className="text-cw-accent" rolling={r.spinning && priceReel} pop={r.animate} />
            </div>
            <ol className="px-3 py-1">
                {legs.map((o, i) => (
                    <Leg key={o.odd_id} o={o} last={i === legs.length - 1} dot="bg-cw-accent ring-cw-accent/20"
                        reel={r.animate ? { ...reels[i], spinning: i >= r.landed } : undefined}
                        added={added === o.odd_id} onAdd={() => single(o)} />
                ))}
            </ol>
            <SlipCta done={added === 'bb'} doneText={t('addedToBetslip')} value={bb.value} disabled={r.spinning}
                onClick={() => { onAction({ action: 'add_bet_builder', bet_builder: bb, fixture: f }); flash('bb'); }}>
                {t('addBetBuilder')}
            </SlipCta>
        </SlipCard>
    );
}

function Betslip({ data, onAction, reveal }) {
    return data.type === 'acca' ? <Acca data={data} onAction={onAction} reveal={reveal} /> : <BetBuilder data={data} onAction={onAction} reveal={reveal} />;
}

function Insights({ data, onAction }) {
    const { t } = useI18n();
    return (
        <Card title={t('ourPicks')}>
            <div className="space-y-2">
                {(data.insights ?? []).map((i) => (
                    <div key={i.id} className="text-sm">
                        <div className="flex justify-between gap-2">
                            <span className="text-cw-text">{i.bet?.label_name} <span className="text-cw-muted">· {i.bet?.market_name}</span></span>
                            <button type="button" title={t('addToBetslip')} onClick={() => onAction({ action: 'add_to_betslip', selections: [i.bet] })}
                                className="text-cw-odds font-bold hover:underline">{price(i.bet?.value)}</button>
                        </div>
                        {i.content?.text && <div className="text-xs text-cw-muted mt-0.5">{i.content.text}</div>}
                    </div>
                ))}
            </div>
        </Card>
    );
}

// `reveal` (ms delay, or null) plays the slot-machine reveal on a betslip.
export function ChatItem({ item, onAction = () => {}, reveal = null }) {
    const { kind, data } = item;
    switch (kind) {
        case 'fixture': return <FixtureCard data={data} onAction={onAction} />;
        case 'odd': return <OddChip data={data} onAction={onAction} />;
        case 'odds': return <OddsTable data={data} onAction={onAction} />;
        case 'betslip': return <Betslip data={data} onAction={onAction} reveal={reveal} />;
        case 'lineups': return <Lineups data={data} onAction={onAction} />;
        case 'form': return <Form data={data} />;
        case 'insights': return <Insights data={data} onAction={onAction} />;
        case 'statistics': return <MatchStats data={data} />;
        case 'timeline': return <Timeline data={data} />;
        case 'predictions': return <Predictions data={data} />;
        default: return null; // a kind this version does not know yet
    }
}

// Items that need the full width: the pitch, and the stats with their per-minute chart.
const WIDE = new Set(['lineups', 'statistics', 'timeline']);

// Several betslips in one fresh answer start their reveals this far apart.
const REVEAL_STAGGER = 400;

// What a client shows of a turn's `ui`: everything the model picked, plus the auto items a user
// expects to see even unpicked (the betslip it built, the lineup it opened).
export const visibleItems = (ui) => (ui ?? []).filter((u) => u.source === 'model' || u.kind === 'betslip' || u.kind === 'lineups');

// `reveal`: the answer has just arrived (not loaded from history) - its betslips spin in.
// Two columns once the container is wide enough (container query: the widget's panel is narrow
// even on a wide screen).
export function ChatItems({ items, onAction, reveal = false }) {
    if (!items?.length) return null;
    // A player's card (a lineups item opened on him) is the answer to a player question: it leads.
    const lead = (i) => (i.kind === 'lineups' && i.data?.focus_player_id ? 0 : 1);
    // The match-stats card already draws the chart a timeline item would: show it once.
    const statsOf = new Set(items.filter((i) => i.kind === 'statistics').map((i) => i.data?.fixture_id));
    const ordered = items.filter((i) => !(i.kind === 'timeline' && statsOf.has(i.data?.fixture_id))).sort((a, b) => lead(a) - lead(b));
    let slips = 0;
    return (
        <div className="@container">
            <div className="grid gap-2 @xl:grid-cols-2">
                {ordered.map((item) => (
                    <div key={item.ref} className={WIDE.has(item.kind) ? '@xl:col-span-2' : undefined}>
                        <ChatItem item={item} onAction={onAction}
                            reveal={reveal && item.kind === 'betslip' ? REVEAL_STAGGER * slips++ : null} />
                    </div>
                ))}
            </div>
        </div>
    );
}
