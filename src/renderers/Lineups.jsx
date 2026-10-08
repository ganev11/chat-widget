/** @jsxImportSource preact */
// Lineups as a pitch, with a player card behind every player. Everything a card shows travels in
// the item (the chatbot's get_fixture lineups section): lineup rows, the in-squad roster, the
// players' metrics and the sportsbook's open player-market prices — opening a card never calls
// the backend. Without a lineup (neither predicted nor confirmed) the squads are listed instead.
// A predicted lineup has no bench, and none is invented.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useI18n } from '../i18n/index.js';
import { price } from './util.js';

const playerName = (p) => (p?.display_name ?? p?.common_name ?? '').trim();
const shortName = (p) => (p?.lastname ?? '').trim() || playerName(p).split(' ').at(-1);

// Position badge colours are fixed: they must tell positions apart in any theme.
const POSITIONS = {
    GOALKEEPER: { short: 'posGK', label: 'goalkeepers', badge: 'text-[#c27803] border-[#c27803]/50' },
    DEFENDER: { short: 'posDEF', label: 'defenders', badge: 'text-[#1d8fd1] border-[#1d8fd1]/50' },
    MIDFIELDER: { short: 'posMID', label: 'midfielders', badge: 'text-[#16a34a] border-[#16a34a]/50' },
    ATTACKER: { short: 'posFWD', label: 'forwards', badge: 'text-[#dc2626] border-[#dc2626]/50' },
};
const POSITION_ORDER = ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'ATTACKER'];

// 0-100, 50 = the average player in the same position.
const RATINGS = [
    ['PLAYER_SST_RATING', 'ratingOverall'],
    ['PLAYER_IMPACT_INDEX', 'ratingImpact'],
    ['PLAYER_AGGRESSION_INDEX', 'ratingAggression'],
    ['PLAYER_DISCIPLINE_INDEX', 'ratingDiscipline'],
];
const band = (v) => (v < 40
    ? { label: 'belowAvg', text: 'text-cw-warning', bar: 'bg-cw-warning' }
    : v > 60
        ? { label: 'aboveAvg', text: 'text-cw-success', bar: 'bg-cw-success' }
        : { label: 'average', text: 'text-cw-muted', bar: 'bg-cw-subtle' });

const EXPECTED = [
    ['PLAYER_EXPECTED_MINUTES', 'xMinutes', 0],
    ['PLAYER_EXPECTED_GOALS', 'xGoals', 2],
    ['PLAYER_EXPECTED_ASSISTS', 'xAssists', 2],
    ['PLAYER_EXPECTED_GOAL_INVOLVEMENTS', 'xInvolvements', 2],
    ['PLAYER_EXPECTED_SHOTS', 'xShots', 2],
    ['PLAYER_EXPECTED_SHOTS_ON_TARGET', 'xOnTarget', 2],
    ['PLAYER_EXPECTED_PASSES', 'xPasses', 1],
    ['PLAYER_EXPECTED_TACKLES', 'xTackles', 2],
    ['PLAYER_EXPECTED_FOULS', 'xFouls', 2],
    ['PLAYER_EXPECTED_BOOKING_POINTS', 'xBookingPoints', 2],
    ['PLAYER_EXPECTED_SAVES', 'xSaves', 2],
];

const STATUS = { starting: 'playerStarting', predicted: 'playerPredicted', bench: 'playerBench', squad: 'playerSquad' };

// Starters (sorted by formation_position, 1 = goalkeeper) split into rows from the goalkeeper up.
// "4-2-3-1" → [1, 4, 2, 3, 1]. A missing or inconsistent formation falls back to position groups.
function pitchRows(starters, formation) {
    const counts = (formation ?? '').split('-').map(Number).filter((n) => n > 0);
    if (counts.length && counts.reduce((a, b) => a + b, 0) === starters.length - 1) {
        const rows = [starters.slice(0, 1)];
        let i = 1;
        for (const n of counts) { rows.push(starters.slice(i, i + n)); i += n; }
        return rows;
    }
    return POSITION_ORDER.map((p) => starters.filter((l) => l.player?.developer_name === p))
        .concat([starters.filter((l) => !POSITION_ORDER.includes(l.player?.developer_name))])
        .filter((r) => r.length);
}

const Shirt = ({ number, keeper, away, size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <path d="M11 3 L4 7 L1 14 L6 16 L7 13 L7 29 L25 29 L25 13 L26 16 L31 14 L28 7 L21 3 Q16 7 11 3 Z"
            fill={keeper ? '#f59e0b' : away ? '#e5e7eb' : '#059669'} stroke="rgba(0,0,0,0.15)" />
        {/* Preact sets SVG attributes verbatim: camelCase textAnchor/fontSize would be ignored. */}
        <text x="16" y="18" text-anchor="middle" dominant-baseline="middle" font-size={String(number ?? '').length > 1 ? 10 : 11} font-weight="700"
            fill={away && !keeper ? '#111827' : '#ffffff'}>{number ?? ''}</text>
    </svg>
);

function PitchMarkings() {
    const line = 'absolute border border-white/25';
    return (
        <>
            <div className={`${line} inset-2 rounded-sm`} />
            <div className="absolute left-2 right-2 top-1/2 border-t border-white/25" />
            <div className={`${line} left-1/2 top-1/2 w-[26%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full`} />
            <div className={`${line} left-1/2 top-2 w-[56%] h-[14%] -translate-x-1/2 border-t-0`} />
            <div className={`${line} left-1/2 top-2 w-[26%] h-[5%] -translate-x-1/2 border-t-0`} />
            <div className={`${line} left-1/2 bottom-2 w-[56%] h-[14%] -translate-x-1/2 border-b-0`} />
            <div className={`${line} left-1/2 bottom-2 w-[26%] h-[5%] -translate-x-1/2 border-b-0`} />
        </>
    );
}

// The player asked about (focus) is ringed in the highlight colour; the one whose card is open,
// white — or highlight when there is no focus.
const ringOf = (id, selected, focusId) => (id === focusId || (id === selected && !focusId)
    ? 'ring-2 ring-cw-highlight bg-black/25'
    : id === selected ? 'ring-2 ring-white bg-black/25' : '');

function Pitch({ rows, away, selected, focusId, onSelect }) {
    // Goalkeeper at the bottom, forwards at the top.
    const y = (r) => 88 - (r * 70) / Math.max(1, rows.length - 1);
    return (
        <div className="relative w-full max-w-md mx-auto aspect-[68/90] rounded-md bg-cw-pitch overflow-hidden">
            <PitchMarkings />
            {rows.map((row, r) => row.map((l, i) => {
                const id = l.player?.player_id;
                const ring = ringOf(id, selected, focusId);
                return (
                    <button key={id} type="button" onClick={() => onSelect(id)}
                        style={{ left: `${((i + 1) * 100) / (row.length + 1)}%`, top: `${y(r)}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center w-16 group">
                        <span className={`rounded-full p-0.5 ${ring || 'group-hover:bg-black/20'}`}>
                            <Shirt number={l.number} keeper={r === 0} away={away} />
                        </span>
                        <span className={`text-[10px] leading-tight truncate max-w-full drop-shadow ${id === focusId ? 'text-cw-highlight font-semibold' : 'text-white'}`}>
                            {shortName(l.player)}
                        </span>
                    </button>
                );
            }))}
        </div>
    );
}

function PlayerList({ title, players, away, selected, focusId, onSelect }) {
    if (!players.length) return null;
    return (
        <div>
            <div className="text-[11px] uppercase tracking-wider text-cw-subtle mb-1">{title}</div>
            <div className="grid grid-cols-2 @md:grid-cols-3 gap-1">
                {players.map((p) => (
                    <button key={p.id} type="button" onClick={() => onSelect(p.id)}
                        className={`flex items-center gap-2 px-2 py-1 rounded text-left text-xs ${ringOf(p.id, selected, focusId) || 'bg-cw-surface-alt hover:bg-cw-surface-hover'} ${p.id === focusId ? 'text-cw-highlight' : 'text-cw-text'}`}>
                        <Shirt number={p.number} keeper={p.position === 'GOALKEEPER'} away={away} size={20} />
                        <span className="truncate">{p.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function PlayerCard({ player, team, metrics, odds, away, onClose, onAction, floating }) {
    const { t } = useI18n();
    const pos = POSITIONS[player.position];
    const value = (name) => metrics.find((m) => m.developer_name === name);
    const start = metrics.find((m) => m.meta?.p_start !== undefined)?.meta?.p_start;
    const ratings = RATINGS.map(([name, label]) => [label, value(name)?.value]).filter(([, v]) => typeof v === 'number');
    const expected = EXPECTED
        .filter(([name]) => name !== 'PLAYER_EXPECTED_SAVES' || player.position === 'GOALKEEPER')
        .map(([name, label, dp]) => [label, value(name)?.value, dp])
        .filter(([, v]) => typeof v === 'number');

    // Base markets first, Golden Sub (350+) after; lines in order.
    const markets = new Map();
    for (const o of [...odds].sort((a, b) => a.market_id - b.market_id || a.line - b.line || a.label_id - b.label_id)) {
        if (!markets.has(o.market_id)) markets.set(o.market_id, []);
        markets.get(o.market_id).push(o);
    }

    return (
        <div className={`rounded-cw border border-cw-border bg-cw-surface ${floating ? 'shadow-xl' : ''}`}>
            <div className="flex items-start gap-3 px-3 pt-3">
                <Shirt number={player.number} keeper={player.position === 'GOALKEEPER'} away={away} size={36} />
                <div className="flex-1 min-w-0">
                    <div className="text-cw-text font-semibold truncate">{player.name}</div>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs mt-0.5">
                        {pos && <span className={`px-1.5 rounded border ${pos.badge}`}>{t(pos.short)}</span>}
                        <span className="text-cw-muted truncate">{team ? `${team} · ` : ''}{t(STATUS[player.status])}</span>
                        {typeof start === 'number' && <span className="text-cw-muted">· {t('startChance', { p: Math.round(start * 100) })}</span>}
                    </div>
                </div>
                {onClose && <button type="button" onClick={onClose} aria-label={t('close')} className="text-cw-muted hover:text-cw-text text-lg leading-none px-1">×</button>}
            </div>

            <div className={`px-3 py-3 space-y-2.5 overflow-y-auto overscroll-contain cw-scroll ${floating ? 'max-h-[24rem]' : 'max-h-[28rem]'}`}>
                {ratings.map(([label, v]) => {
                    const b = band(v);
                    return (
                        <div key={label}>
                            <div className="flex items-baseline justify-between text-sm">
                                <span className="text-cw-text">{t(label)}</span>
                                <span className="flex items-baseline gap-2">
                                    <span className="text-[10px] uppercase tracking-wider text-cw-subtle">{t(b.label)}</span>
                                    <span className={`font-semibold tabular-nums ${b.text}`}>{Math.round(v)}</span>
                                </span>
                            </div>
                            <div className="h-1 mt-1 rounded bg-cw-surface-alt"><div className={`h-1 rounded ${b.bar}`} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></div>
                        </div>
                    );
                })}

                {expected.length > 0 && (
                    <div className="pt-1">
                        <div className="text-[11px] uppercase tracking-wider text-cw-subtle mb-1">{t('expectedThisMatch')}</div>
                        <div className="grid grid-cols-3 gap-1">
                            {expected.map(([label, v, dp]) => (
                                <div key={label} className="rounded bg-cw-surface-alt px-2 py-1">
                                    <div className="text-[10px] text-cw-subtle truncate">{t(label)}</div>
                                    <div className="text-sm text-cw-text tabular-nums">{v.toFixed(dp)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!ratings.length && !expected.length && <div className="text-xs text-cw-subtle">{t('noPlayerMetrics')}</div>}

                {markets.size > 0 && (
                    <div className="pt-1 space-y-2">
                        <div className="text-[11px] uppercase tracking-wider text-cw-subtle">{t('bettingMarkets')}</div>
                        {[...markets.values()].map((rows) => (
                            <div key={rows[0].market_id} className="rounded border border-cw-border">
                                <div className="px-2 pt-1.5 text-xs font-medium text-cw-text">{rows[0].market_name}</div>
                                {rows.map((o) => (
                                    <div key={o.odd_id} className="flex items-center gap-2 px-2 py-1">
                                        <span className="flex-1 text-xs text-cw-muted truncate">{o.label_name || t('yes')}</span>
                                        <span className="text-sm font-semibold text-cw-odds tabular-nums">{price(o.value)}</span>
                                        <button type="button" onClick={() => onAction({ action: 'add_to_betslip', selections: [o] })}
                                            className="px-2 py-0.5 rounded bg-cw-surface-alt hover:bg-cw-primary hover:text-cw-on-primary text-[11px] font-semibold text-cw-text">
                                            {t('add')} →
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// A tapped player's card opens over the pitch (Esc or × closes it). It stays inside the lineup
// card, so it works the same in a narrow chat panel, an inline widget and a full page.
function PlayerOverlay({ onClose, children }) {
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return <div className="absolute inset-x-2 top-2 z-10 max-w-sm mx-auto">{children}</div>;
}

export function Lineups({ data, onAction }) {
    const { t } = useI18n();
    const teams = ['home', 'away'].map((loc) => data.participants?.find((p) => p.location === loc)).filter(Boolean);
    const confirmed = data.metadata?.find((m) => m.developer_name === 'LINEUP_CONFIRMED')?.meta?.confirmed;
    const hasLineup = (data.rows ?? []).some((r) => r.developer_name === 'LINEUP');

    // Every player the item knows, by id: lineup row first (number, lineup status), squad otherwise.
    const players = useMemo(() => {
        const m = new Map();
        for (const s of data.squads ?? []) {
            m.set(s.player_id, { id: s.player_id, team_id: s.team_id, name: playerName(s), position: s.developer_name, status: 'squad' });
        }
        for (const l of data.rows ?? []) {
            const id = l.player?.player_id;
            const sq = m.get(id);
            m.set(id, {
                id, team_id: l.team_id, number: l.number, name: playerName(l.player),
                position: l.player?.developer_name ?? sq?.position,
                status: l.developer_name === 'LINEUP' ? (confirmed ? 'starting' : 'predicted') : 'bench',
            });
        }
        return m;
    }, [data]);

    // About one player (focus): his card leads and never changes — it is the answer. The lineup is
    // behind a toggle, and a player tapped there opens over the pitch, not in that card.
    const focus = players.get(data.focus_player_id);
    const playerMode = Boolean(focus);
    const [teamId, setTeamId] = useState(focus?.team_id ?? teams[0]?.id);
    const [selected, setSelected] = useState(null);
    const [showLineup, setShowLineup] = useState(!playerMode);
    const away = teamId === teams[1]?.id;

    const rows = (data.rows ?? []).filter((r) => r.team_id === teamId);
    const starters = rows.filter((r) => r.developer_name === 'LINEUP').sort((a, b) => (a.formation_position ?? 99) - (b.formation_position ?? 99));
    const formation = data.metadata?.find((m) => m.developer_name === 'FORMATION' && m.team_id === teamId)?.meta?.formation;
    const bench = rows.filter((r) => r.developer_name === 'BENCH').map((r) => ({ ...players.get(r.player?.player_id) }));
    const squad = [...players.values()].filter((p) => p.team_id === teamId)
        .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || a.name.localeCompare(b.name));

    const select = (id) => setSelected((cur) => (cur === id ? null : id));
    const close = () => setSelected(null);
    const cardOf = (p, props) => (
        <PlayerCard
            player={p}
            team={teams.find((x) => x.id === p.team_id)?.name}
            away={p.team_id === teams[1]?.id}
            metrics={(data.player_metrics ?? []).filter((m) => m.player_id === p.id)}
            odds={(data.odds ?? []).filter((o) => o.player_id === p.id && !o.suspend)}
            onAction={onAction}
            {...props}
        />
    );
    const opened = selected && players.get(selected);
    const toggleLabel = hasLineup
        ? (confirmed ? (showLineup ? 'hideLineup' : 'showLineup') : (showLineup ? 'hidePredictedLineup' : 'showPredictedLineup'))
        : (showLineup ? 'hideSquads' : 'showSquads');

    const lineup = (
        <>
            <div className="flex border-b border-cw-border">
                {teams.map((x) => (
                    <button key={x.id} type="button" onClick={() => { setTeamId(x.id); close(); }}
                        className={`flex-1 py-2 text-sm font-medium truncate px-2 border-b-2 ${x.id === teamId ? 'text-cw-text border-cw-primary' : 'text-cw-muted border-transparent hover:text-cw-text'}`}>
                        {x.name}
                    </button>
                ))}
            </div>

            <div className={`relative p-3 space-y-3 ${opened ? 'min-h-[30rem]' : ''}`}>
                <div className="text-center text-[11px] uppercase tracking-widest">
                    {hasLineup
                        ? <span className={confirmed ? 'text-cw-success' : 'text-cw-warning'}>{confirmed ? t('confirmedXI') : t('predictedXI')}{formation && <span className="ml-2 text-cw-muted">{formation}</span>}</span>
                        : <span className="text-cw-muted">{t('noLineupSquad')}</span>}
                </div>

                {hasLineup && starters.length > 0 && <Pitch rows={pitchRows(starters, formation)} away={away} selected={selected} focusId={focus?.id} onSelect={select} />}
                {hasLineup && !starters.length && <div className="text-center text-xs text-cw-subtle">{t('noTeamLineup')}</div>}
                {hasLineup && <PlayerList title={t('substitutes')} players={bench} away={away} selected={selected} focusId={focus?.id} onSelect={select} />}
                {!hasLineup && POSITION_ORDER.map((pos) => (
                    <PlayerList key={pos} title={t(POSITIONS[pos].label)} players={squad.filter((p) => p.position === pos)} away={away} selected={selected} focusId={focus?.id} onSelect={select} />
                ))}

                {opened && <PlayerOverlay onClose={close}>{cardOf(opened, { floating: true, onClose: close })}</PlayerOverlay>}
            </div>
        </>
    );

    if (playerMode) {
        return (
            <div className="space-y-2">
                <div className="max-w-sm">{cardOf(focus)}</div>
                <button type="button" onClick={() => { setShowLineup((v) => !v); close(); }}
                    className="text-xs text-cw-muted hover:text-cw-text">
                    {t(toggleLabel)} {showLineup ? '▴' : '▾'}
                </button>
                {showLineup && <div className="rounded-cw border border-cw-border bg-cw-surface overflow-hidden">{lineup}</div>}
            </div>
        );
    }
    return <div className="rounded-cw border border-cw-border bg-cw-surface overflow-hidden">{lineup}</div>;
}
