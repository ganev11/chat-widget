/** @jsxImportSource preact */
// Match stats (live/finished): per-period tabs, a diverging bar per stat coloured by how lopsided
// it is, and the per-minute trends chart under it. The timeline item (goals & cards) is the same
// chart on its own. Everything comes in the item (get_fixture statistics/timeline sections).
import { useMemo, useState } from 'preact/hooks';
import { useI18n } from '../i18n/index.js';
import { StatIcon } from './icons.jsx';
import { TrendsChart } from './TrendsChart.jsx';
import { side } from './util.js';

// Highlight bands by the ratio of the larger value to the smaller, strongest first. Fixed colours:
// they read the same on light and dark.
export const HIGHLIGHTS = [
    { threshold: 3.1, class: 'bg-[#d01c1f] text-white' },
    { threshold: 1.9, class: 'bg-[#f1cb22] text-black' },
    { threshold: 1.3, class: 'bg-[#949599] text-white' },
];
export const NEUTRAL_BAR = 'bg-cw-subtle/60';

const ORDER = [
    'GOALS', 'PENALTIES', 'SHOTS_ON_TARGET', 'SHOTS_OFF_TARGET', 'SHOTS_TOTAL', 'CORNERS', 'BALL_POSSESSION', 'ATTACKS',
    'DANGEROUS_ATTACKS', 'YELLOWCARDS', 'REDCARDS', 'SUBSTITUTIONS', 'EXPECTED_GOALS', 'PRESSURE_INDEX',
    'FOULS', 'OFFSIDES', 'SAVES', 'SUCCESSFUL_PASSES_PERCENTAGE',
];
// Whole-match values only: no period rows.
const NO_PERIOD = new Set(['EXPECTED_GOALS', 'PRESSURE_INDEX']);

const TABS = [
    { name: 'tabFull', prefix: '' },
    { name: 'tab1H', prefix: 'LAST_HT_' },
    { name: 'tab2H', prefix: 'LAST_SH_' },
    { name: 'tabLast20', prefix: 'LAST_20_', live: true },
    { name: 'tabLast10', prefix: 'LAST_10_', live: true },
    { name: 'tabLast5', prefix: 'LAST_5_', live: true },
];
const FINISHED = new Set(['FT', 'FT_AET', 'FT_PEN', 'FT_UNCONFIRMED', 'AWARDED', 'WALKOVER']);

// The chart rebuilds when its `fixture` changes identity: hand it a stable one.
function MatchChart({ data }) {
    const fixture = useMemo(() => ({ participants: data.participants, periods: data.periods ?? [], trends: data.trends ?? [] }), [data]);
    return <TrendsChart fixture={fixture} />;
}

export const Frame = ({ title, children }) => (
    <div className="rounded-cw border border-cw-border bg-cw-surface overflow-hidden">
        <div className="px-3 py-2 border-b border-cw-border text-sm font-semibold text-cw-text">{title}</div>
        <div className="px-3 py-2">{children}</div>
    </div>
);

// Two values as a diverging bar: each half scaled to the larger value, the leader coloured by band.
export function DivergingRow({ label, icon, home, away, format, extra }) {
    const h = home ?? 0;
    const a = away ?? 0;
    const max = Math.max(h, a);
    const min = Math.min(h, a);
    const ratio = min === 0 ? max : max / min;
    const band = max > 0 ? HIGHLIGHTS.find((x) => ratio >= x.threshold) : null;
    const homeLeads = band && h >= a;
    const awayLeads = band && a > h;
    return (
        <div className="py-1.5">
            <div className="flex items-center gap-2">
                <span className={`min-w-9 text-center text-sm font-semibold rounded px-1 ${homeLeads ? band.class : 'text-cw-text'}`}>{format(h, 'home')}</span>
                <span className="flex-1 flex items-center justify-center gap-1.5 min-w-0 text-xs text-cw-muted">
                    {icon && <StatIcon name={icon} className="w-4 h-4 text-cw-text" />}
                    <span className="truncate">{label}</span>
                    {extra}
                </span>
                <span className={`min-w-9 text-center text-sm font-semibold rounded px-1 ${awayLeads ? band.class : 'text-cw-text'}`}>{format(a, 'away')}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full overflow-hidden bg-cw-surface-alt flex">
                <div className="w-1/2 flex justify-end">
                    <div className={`h-full ${homeLeads ? band.class : NEUTRAL_BAR}`} style={{ width: `${max > 0 ? (h / max) * 100 : 0}%` }} />
                </div>
                <div className="w-px bg-cw-border shrink-0" />
                <div className="w-1/2">
                    <div className={`h-full ${awayLeads ? band.class : NEUTRAL_BAR}`} style={{ width: `${max > 0 ? (a / max) * 100 : 0}%` }} />
                </div>
            </div>
        </div>
    );
}

function StatRow({ name, home, away }) {
    const { t } = useI18n();
    const scale = name === 'EXPECTED_GOALS' ? 100 : 1;
    // No row = nothing recorded (period stats are only stored once non-zero): show 0.
    const format = (v, s) => (scale > 1 ? v.toFixed(2) : (s === 'home' ? home : away) ?? 0);
    return <DivergingRow label={t(`stat_${name}`)} icon={name} home={(home ?? 0) / scale} away={(away ?? 0) / scale} format={format} />;
}

export function MatchStats({ data }) {
    const { t } = useI18n();
    const home = side(data, 'home');
    const away = side(data, 'away');
    const value = new Map((data.rows ?? []).map((r) => [`${r.team_id}:${r.developer_name}`, r.value]));
    const has = (prefix) => (data.rows ?? []).some((r) => r.developer_name.startsWith(prefix));
    const live = !FINISHED.has(data.status);
    const tabs = TABS.filter((tab) => (!tab.live || live) && (tab.prefix === '' || has(tab.prefix)));
    const [tab, setTab] = useState('');

    const rows = ORDER.filter((name) => !tab || !NO_PERIOD.has(name)).map((name) => ({
        name,
        h: value.get(`${home?.id}:${tab}${name}`),
        a: value.get(`${away?.id}:${tab}${name}`),
    })).filter(({ h, a }) => (h ?? 0) + (a ?? 0) > 0);

    return (
        <Frame title={t('matchStats')}>
            {tabs.length > 1 && (
                <div role="tablist" className="flex gap-3 overflow-x-auto cw-scroll -mx-3 px-3 mb-2 border-b border-cw-border">
                    {tabs.map((x) => (
                        <button key={x.prefix} role="tab" type="button" aria-selected={tab === x.prefix} onClick={() => setTab(x.prefix)}
                            className={`shrink-0 pb-1.5 text-xs font-medium border-b-2 ${tab === x.prefix ? 'border-cw-primary text-cw-text' : 'border-transparent text-cw-muted hover:text-cw-text'}`}>
                            {t(x.name)}
                        </button>
                    ))}
                </div>
            )}
            <div className="flex justify-between text-xs font-medium text-cw-muted mb-1">
                <span className="truncate">{home?.name}</span>
                <span className="truncate text-right">{away?.name}</span>
            </div>
            {rows.length
                ? <div className="divide-y divide-cw-border/60">{rows.map((r) => <StatRow key={r.name} name={r.name} home={r.h} away={r.a} />)}</div>
                : <div className="py-2 text-xs text-cw-subtle">{t('noStats')}</div>}
            <MatchChart data={data} />
        </Frame>
    );
}

export function Timeline({ data }) {
    const { t } = useI18n();
    const home = side(data, 'home');
    const away = side(data, 'away');
    return (
        <Frame title={t('goalsAndCards')}>
            <div className="flex justify-between text-xs text-cw-muted">
                <span className="truncate">▲ {home?.name}</span>
                <span className="truncate text-right">{away?.name} ▼</span>
            </div>
            <MatchChart data={data} />
        </Frame>
    );
}
