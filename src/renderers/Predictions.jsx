/** @jsxImportSource preact */
// Pre-match model predictions (get_fixture predictions section): each side's strength class, the
// expected goals/corners/yellows as diverging bars like the match stats, and the over/under
// probability of each total. `data.rows` are the API's metric rows; model versions (_V2) are ours,
// not the reader's, so they never reach a label.
import { useI18n } from '../i18n/index.js';
import { StatIcon } from './icons.jsx';
import { DivergingRow, Frame } from './MatchStats.jsx';
import { side } from './util.js';

// TEAM_GOALS_CLASSIFICATION value → class.
const CLASSES = [
    { label: 'classWeak', badge: 'border border-cw-border text-cw-muted' },
    { label: 'classAverage', badge: 'bg-cw-surface-alt text-cw-text' },
    { label: 'classStrong', badge: 'bg-cw-primary text-cw-on-primary' },
    { label: 'classTop', badge: 'bg-[#f1cb22] text-black' },
];

const EXPECTED = [
    { name: 'FT_EXPECTED_GOALS_V2', label: 'xGoals', icon: 'GOALS' },
    { name: 'FT_EXPECTED_CORNERS_V2', label: 'xCorners', icon: 'CORNERS' },
    { name: 'FT_EXPECTED_YELLOWCARDS_V2', label: 'xYellowCards', icon: 'YELLOWCARDS' },
];

// value = P(over meta.line) in %. The fallback lines are the ones the API publishes.
const TOTALS = [
    { name: 'FT_TOTAL_GOALS_V2', label: 'tGoals', icon: 'GOALS', line: 2.5 },
    { name: 'FT_TOTAL_CORNERS_V2', label: 'tCorners', icon: 'CORNERS', line: 9.5 },
    { name: 'FT_TOTAL_CARDS_V2', label: 'tCards', icon: 'YELLOWCARDS', line: 4.5 },
];

const r2 = (v) => Math.round(v * 100) / 100;

const Heading = ({ children }) => (
    <div className="mt-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-cw-subtle">{children}</div>
);

function ClassBadge({ value, align }) {
    const { t } = useI18n();
    const cls = CLASSES[value];
    if (!cls) return null;
    return (
        <div className={`mt-1 flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
            <span className={`text-[11px] font-semibold rounded px-1.5 py-px ${cls.badge}`}>{t(cls.label)}</span>
            <span className="flex gap-0.5" title={t('classOf', { n: value + 1, max: CLASSES.length })}>
                {CLASSES.map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= value ? 'bg-cw-text' : 'bg-cw-border'}`} />
                ))}
            </span>
        </div>
    );
}

// One bar split at P(over): the likelier side is lit, a tick marks 50%.
function TotalRow({ label, icon, line, over }) {
    const { t } = useI18n();
    const o = Math.max(0, Math.min(100, over));
    const u = 100 - o;
    const overLikely = o >= 50;
    return (
        <div className="py-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
                <span className={overLikely ? 'text-cw-text font-semibold' : 'text-cw-muted'}>{t('over', { line })} <span className="font-normal text-cw-muted">{t(label)}</span></span>
                <StatIcon name={icon} className="w-4 h-4 opacity-70 text-cw-text" />
                <span className={!overLikely ? 'text-cw-text font-semibold' : 'text-cw-muted'}>{t('under', { line })}</span>
            </div>
            <div className="relative mt-1 h-5 rounded overflow-hidden bg-cw-surface-alt flex text-[11px] font-semibold">
                <div className={`flex items-center pl-1.5 ${overLikely ? 'bg-cw-primary text-cw-on-primary' : 'bg-cw-border text-cw-muted'}`} style={{ width: `${o}%` }}>
                    {o >= 15 && `${Math.round(o)}%`}
                </div>
                <div className={`flex-1 flex items-center justify-end pr-1.5 ${!overLikely ? 'bg-cw-primary text-cw-on-primary' : 'text-cw-muted'}`}>
                    {u >= 15 && `${Math.round(u)}%`}
                </div>
                <div className="absolute inset-y-0 left-1/2 w-px bg-black/25" />
            </div>
        </div>
    );
}

export function Predictions({ data }) {
    const { t } = useI18n();
    const home = side(data, 'home');
    const away = side(data, 'away');
    const rows = data.rows ?? [];
    const teamValue = (name, team) => rows.find((r) => r.developer_name === name && r.team_id === team?.id)?.value;

    const classOf = (team) => {
        const v = Number(teamValue('TEAM_GOALS_CLASSIFICATION', team));
        return Number.isInteger(v) ? v : null;
    };
    const expected = EXPECTED.map((e) => ({ ...e, h: teamValue(e.name, home), a: teamValue(e.name, away) }))
        .filter((e) => typeof e.h === 'number' || typeof e.a === 'number');
    const totals = TOTALS.map((x) => {
        const r = rows.find((row) => row.developer_name === x.name);
        return r && typeof r.value === 'number' ? { ...x, line: r.meta?.line ?? x.line, over: r.value } : null;
    }).filter(Boolean);

    return (
        <Frame title={t('modelPredictions')}>
            <div className="flex justify-between gap-3">
                <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-cw-muted">{home?.name}</div>
                    <ClassBadge value={classOf(home)} />
                </div>
                <div className="min-w-0 text-right">
                    <div className="truncate text-xs font-medium text-cw-muted">{away?.name}</div>
                    <ClassBadge value={classOf(away)} align="right" />
                </div>
            </div>
            {expected.length > 0 && (
                <>
                    <Heading>{t('expected')}</Heading>
                    <div className="divide-y divide-cw-border/60">
                        {expected.map((e) => (
                            <DivergingRow key={e.name} label={t(e.label)} icon={e.icon} home={e.h} away={e.a}
                                format={(v) => v.toFixed(2)}
                                extra={<span className="text-cw-subtle">· {r2((e.h ?? 0) + (e.a ?? 0)).toFixed(2)}</span>} />
                        ))}
                    </div>
                </>
            )}
            {totals.length > 0 && (
                <>
                    <Heading>{t('overUnder')}</Heading>
                    {totals.map((x) => <TotalRow key={x.name} label={x.label} icon={x.icon} line={x.line} over={x.over} />)}
                </>
            )}
        </Frame>
    );
}
