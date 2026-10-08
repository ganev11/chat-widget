/** @jsxImportSource preact */
// Per-minute trends of a match as a diverging bar chart — home up, away down — with goals, cards
// and shots marked on a timeline above (home) and below (away). The same reading as the SSTrader
// fixture page's chart, drawn in plain SVG so the widget carries no chart library.
import { useMemo, useState } from 'preact/hooks';
import { useI18n } from '../i18n/index.js';
import { StatIcon, hasStatIcon } from './icons.jsx';

const STAT_COLORS = {
    ATTACKS: { home: '#00a2d0', away: '#66b2d2' },
    DANGEROUS_ATTACKS: { home: '#f0ba26', away: '#f1cf6d' },
    BALL_POSSESSION: { home: '#68bd48', away: '#afd33b' },
    PRESSURE_INDEX: { home: '#00a2d0', away: '#66b2d2' },
    EXPECTED_GOALS: { home: '#9b59b6', away: '#c39bd3' },
    SHOTS_ON_TARGET: { home: '#e74c3c', away: '#f1948a' },
    SHOTS_OFF_TARGET: { home: '#e67e22', away: '#f0a87c' },
    CORNERS: { home: '#1abc9c', away: '#76d7c4' },
};
const INJURY_COLORS = { home: '#bb3c83', away: '#bd6b99' };
const DEFAULT_COLORS = { home: '#00a2d0', away: '#66b2d2' };

// Plotted as the running value, not the per-minute increase.
const RAW_STATS = new Set(['PRESSURE_INDEX', 'BALL_POSSESSION', 'EXPECTED_GOALS']);
// Stored as integer × 100.
const SCALE_100_STATS = new Set(['EXPECTED_GOALS']);

const CHARTABLE_STATS = ['PRESSURE_INDEX', 'ATTACKS', 'DANGEROUS_ATTACKS', 'BALL_POSSESSION', 'EXPECTED_GOALS', 'SHOTS_ON_TARGET', 'SHOTS_OFF_TARGET', 'CORNERS'];

// Events found from the running counts and placed on the timeline; goals drawn larger.
const TIMELINE_EVENTS = {
    GOALS: 'w-4 h-4',
    YELLOWCARDS: 'w-3 h-3',
    REDCARDS: 'w-3 h-3',
    SHOTS_ON_TARGET: 'w-2.5 h-2.5',
    SHOTS_OFF_TARGET: 'w-2.5 h-2.5',
};

const CHARTABLE_PERIODS = new Set(['1ST_HALF', '2ND_HALF', 'ET']);
const PERIOD_RANK = { '1ST_HALF': 0, '2ND_HALF': 1, 'ET': 2 };
// Regular halves are always drawn full length, so a live match shows where in the game it is.
const PADDED_PERIODS = [
    { developer_name: '1ST_HALF', counts_from: 0, period_length: 45 },
    { developer_name: '2ND_HALF', counts_from: 45, period_length: 45 },
];
const regularEnd = (p) => (Number(p?.counts_from) || 0) + (Number(p?.period_length) || 45);

// developer_name → team_id → period_id → minute → value
function indexTrends(trends) {
    const idx = {};
    for (const e of trends) {
        ((((idx[e.developer_name] ??= {})[e.team_id] ??= {})[e.period_id] ??= {}))[e.minute] = e.value;
    }
    return idx;
}

// Chronological minute slots from the trends, plus empty (isPad) slots for regular minutes not
// played yet.
function buildSlots(trends, periods) {
    const meta = {};
    for (const p of periods) if (CHARTABLE_PERIODS.has(p.developer_name)) meta[p.period_id] = p;
    for (const d of PADDED_PERIODS) {
        if (!Object.values(meta).some((p) => p.developer_name === d.developer_name)) meta[d.developer_name] = { ...d, period_id: d.developer_name };
    }
    const seen = new Set();
    const raw = [];
    for (const e of trends) {
        if (!meta[e.period_id]) continue;
        const key = `${e.period_id}:${e.minute}`;
        if (!seen.has(key)) { seen.add(key); raw.push({ period_id: e.period_id, minute: e.minute }); }
    }
    if (!raw.length) return [];
    for (const p of Object.values(meta)) {
        for (let m = (Number(p.counts_from) || 0) + 1; m <= regularEnd(p); m++) {
            const key = `${p.period_id}:${m}`;
            if (!seen.has(key)) { seen.add(key); raw.push({ period_id: p.period_id, minute: m, isPad: true }); }
        }
    }
    raw.sort((a, b) => ((PERIOD_RANK[meta[a.period_id]?.developer_name] ?? 0) - (PERIOD_RANK[meta[b.period_id]?.developer_name] ?? 0)) || a.minute - b.minute);
    return raw.map((s) => ({ ...s, isInjury: s.minute > regularEnd(meta[s.period_id]) }));
}

// A counter dropping by >70% from above 10 is a feed error: carry the previous value.
const fixCounter = (v, prev) => (v < prev * 0.3 && prev > 10 ? prev : v);

function detectEvents(slots, idx, teamId, stat) {
    const byPeriod = idx[stat]?.[teamId];
    if (!byPeriod) return [];
    const out = [];
    let prev = 0;
    slots.forEach((slot, i) => {
        if (slot.isPad) return;
        const val = fixCounter(byPeriod[slot.period_id]?.[slot.minute] ?? prev, prev);
        for (let n = 0; n < val - prev; n++) out.push({ i, minute: slot.minute });
        prev = val;
    });
    return out;
}

export function TrendsChart({ fixture, defaultStat = 'PRESSURE_INDEX' }) {
    const { t } = useI18n();
    const trends = fixture?.trends ?? [];
    const periods = fixture?.periods ?? [];
    const home = fixture?.participants?.find((p) => p.location === 'home');
    const away = fixture?.participants?.find((p) => p.location === 'away');
    const available = CHARTABLE_STATS.filter((s) => trends.some((e) => e.developer_name === s));
    const [stat, setStat] = useState(available.includes(defaultStat) ? defaultStat : available[0]);

    const { idx, slots } = useMemo(() => ({
        idx: indexTrends(trends),
        slots: trends.length && periods.length ? buildSlots(trends, periods) : [],
    }), [fixture]);
    const n = slots.length;

    const bars = useMemo(() => {
        if (!n || !home || !away || !stat) return [];
        const raw = RAW_STATS.has(stat);
        const scale = SCALE_100_STATS.has(stat) ? 100 : 1;
        const hd = idx[stat]?.[home.id] ?? {};
        const ad = idx[stat]?.[away.id] ?? {};
        let ph = 0;
        let pa = 0;
        return slots.map((slot) => {
            if (slot.isPad) return null;
            let h = hd[slot.period_id]?.[slot.minute] ?? ph;
            let a = ad[slot.period_id]?.[slot.minute] ?? pa;
            if (!raw) { h = fixCounter(h, ph); a = fixCounter(a, pa); }
            const bar = {
                minute: slot.minute,
                injury: slot.isInjury,
                h: raw ? h / scale : Math.max(0, (h - ph) / scale),
                a: raw ? a / scale : Math.max(0, (a - pa) / scale),
            };
            ph = h;
            pa = a;
            return bar;
        });
    }, [idx, slots, stat]);

    if (!n || !home || !away) return null;

    const events = (team) => Object.keys(TIMELINE_EVENTS).flatMap((name) => detectEvents(slots, idx, team.id, name).map((e) => ({ ...e, name })));
    const max = Math.max(1e-9, ...bars.filter(Boolean).flatMap((b) => [b.h, b.a]));
    const colors = STAT_COLORS[stat] ?? DEFAULT_COLORS;
    const dp = SCALE_100_STATS.has(stat) ? 2 : 0;
    const pct = (i) => `${(((i + 0.5) / n) * 100).toFixed(3)}%`;
    // Quarter-hour dividers.
    const dividers = slots.map((s, i) => (!s.isInjury && s.minute % 15 === 0 && i < n - 1 ? i + 1 : null)).filter((i) => i !== null);
    const H = 32; // half height in SVG units

    const Track = ({ team, top }) => (
        <div className="relative h-5 w-full overflow-hidden">
            {events(team).map((e, k) => (
                <span key={k} className={`absolute -translate-x-1/2 ${top ? 'bottom-0' : 'top-0'}`} style={{ left: pct(e.i) }}>
                    <StatIcon name={e.name} className={`${TIMELINE_EVENTS[e.name]} text-cw-text`} title={`${t(`stat_${e.name}`)} ${e.minute}'`} />
                </span>
            ))}
        </div>
    );

    return (
        <div className="w-full mt-3">
            {available.length > 1 && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {available.map((s) => (
                        <button key={s} type="button" onClick={() => setStat(s)} title={t(`stat_${s}`)}
                            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border transition-colors ${stat === s ? 'border-cw-primary bg-cw-primary/15 text-cw-text' : 'border-cw-border text-cw-muted hover:text-cw-text'}`}>
                            {hasStatIcon(s) ? <StatIcon name={s} className="w-3.5 h-3.5" /> : t(`stat_${s}`)}
                        </button>
                    ))}
                </div>
            )}
            <Track team={home} top />
            <svg viewBox={`0 0 ${n} ${H * 2}`} preserveAspectRatio="none" className="block w-full h-16" role="img" aria-label={t(`stat_${stat}`)}>
                {dividers.map((i) => <line key={i} x1={i} x2={i} y1={0} y2={H * 2} stroke="var(--cw-border)" stroke-width={1} vector-effect="non-scaling-stroke" />)}
                {bars.map((b, i) => b && (
                    <g key={i}>
                        <title>{`${b.minute}' · ${home.name} ${b.h.toFixed(dp)} · ${away.name} ${b.a.toFixed(dp)}`}</title>
                        <rect x={i + 0.075} width={0.85} y={H - (b.h / max) * (H - 1)} height={(b.h / max) * (H - 1)} fill={(b.injury ? INJURY_COLORS : colors).home} />
                        <rect x={i + 0.075} width={0.85} y={H} height={(b.a / max) * (H - 1)} fill={(b.injury ? INJURY_COLORS : colors).away} />
                    </g>
                ))}
                <line x1={0} x2={n} y1={H} y2={H} stroke="var(--cw-border)" stroke-width={1} vector-effect="non-scaling-stroke" />
            </svg>
            <Track team={away} />
        </div>
    );
}
