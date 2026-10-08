/** @jsxImportSource preact */
// A fixture as a compact scoreboard: competition and status chip on top, the two sides with
// initials badges, and the kickoff time (pre-match) or the score (live/finished) on the right.
// The item carries no team logos or colours, so each badge's hue is hashed from the team name.
// "Open event" asks the host to open the match on its own site (open_event, with `integration`:
// the sportsbook's event ids).
import { useEffect, useState } from 'preact/hooks';
import { useI18n } from '../i18n/index.js';
import { dayOf, side, timeOf } from './util.js';

const LIVE = new Set(['INPLAY_1ST_HALF', 'HT', 'INPLAY_2ND_HALF', 'BREAK', 'EXTRA_TIME_BREAK', 'INPLAY_ET', 'PEN_BREAK', 'INPLAY_PENALTIES']);
const FINISHED = { FT: 'statusFT', FT_AET: 'statusAET', FT_PEN: 'statusPens', FT_UNCONFIRMED: 'statusFT', AWARDED: 'statusAwarded', WALKOVER: 'statusWalkover' };
const BREAKS = { HT: 'statusHT', BREAK: 'statusBreak', EXTRA_TIME_BREAK: 'statusETBreak', PEN_BREAK: 'statusPens', INPLAY_PENALTIES: 'statusPens' };

const initials = (name = '') => {
    const words = name.replace(/\b(FC|CF|SC|AC|AFC)\b/g, '').trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
};
const hue = (name = '') => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

// Minutes played, from the ticking period.
function minuteOf(f) {
    const periods = Array.isArray(f.periods) ? f.periods : [];
    const p = periods.find((x) => Number(x.ticking) === 1) || periods.find((x) => x.ended == null && x.started != null);
    if (!p?.started) return null;
    const secs = Date.now() / 1000 - Number(p.started) + (Number(p.counts_from) || 0) * 60;
    return Math.max(1, Math.floor(secs / 60) + 1);
}

// The chat item is a snapshot: tick the minute while the card is on screen.
function useMinute(f, live) {
    const [, setNow] = useState(0);
    useEffect(() => {
        if (!live) return undefined;
        const id = setInterval(() => setNow((n) => n + 1), 30000);
        return () => clearInterval(id);
    }, [live]);
    return live ? minuteOf(f) : null;
}

function StatusChip({ f }) {
    const { t } = useI18n();
    const live = LIVE.has(f.status);
    const minute = useMinute(f, live && !BREAKS[f.status]);
    if (live) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-cw-live/15 px-1.5 py-px text-[10px] font-bold text-cw-live">
                <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inset-0 rounded-full bg-cw-live animate-ping opacity-75" />
                    <span className="relative w-1.5 h-1.5 rounded-full bg-cw-live" />
                </span>
                {BREAKS[f.status] ? t(BREAKS[f.status]) : (minute ? `${minute}'` : t('live'))}
            </span>
        );
    }
    if (FINISHED[f.status]) return <span className="rounded-full bg-cw-surface-alt px-1.5 py-px text-[10px] font-bold text-cw-muted">{t(FINISHED[f.status])}</span>;
    if (f.status && f.status !== 'NOT_STARTED') {
        return <span className="rounded-full bg-cw-warning/15 px-1.5 py-px text-[10px] font-bold text-cw-warning capitalize">{f.status.replaceAll('_', ' ').toLowerCase()}</span>;
    }
    return null;
}

function TeamLine({ team, goals, dim }) {
    const h = hue(team?.name);
    return (
        <div className="flex items-center gap-2 min-w-0">
            <span className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{ background: `linear-gradient(135deg, hsl(${h} 55% 42%), hsl(${(h + 40) % 360} 55% 28%))` }}>
                {initials(team?.name)}
            </span>
            <span className={`flex-1 truncate text-sm ${dim ? 'text-cw-muted' : 'text-cw-text font-medium'}`}>{team?.name ?? '?'}</span>
            {goals !== undefined && <span className={`tabular-nums text-sm font-bold ${dim ? 'text-cw-muted' : 'text-cw-text'}`}>{goals}</span>}
        </div>
    );
}

export function FixtureCard({ data, onAction }) {
    const { t, locale } = useI18n();
    const home = side(data, 'home');
    const away = side(data, 'away');
    const cur = (data.scores ?? []).filter((s) => s.developer_name === 'CURRENT');
    const started = cur.length > 0 || LIVE.has(data.status) || !!FINISHED[data.status];
    const goals = (team) => (started ? cur.find((s) => s.team_id === team?.id)?.value ?? 0 : undefined);
    const [hg, ag] = [goals(home), goals(away)];
    // Finished: the beaten side is dimmed (a draw dims neither).
    const done = !!FINISHED[data.status];
    const canOpen = !!data.integration?.ext_event_id;
    const open = () => onAction({ action: 'open_event', fixture: data, integration: data.integration, fixture_id: data.id });
    const live = LIVE.has(data.status);

    return (
        <div className={`rounded-cw border bg-cw-surface overflow-hidden ${live ? 'border-cw-live/40' : 'border-cw-border'}`}>
            <div className="flex items-center justify-between gap-2 px-3 pt-2">
                <span className="truncate text-[11px] text-cw-muted">
                    {data.league?.name}{data.country?.name ? <span className="text-cw-subtle"> · {data.country.name}</span> : null}
                </span>
                <StatusChip f={data} />
            </div>
            <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0 space-y-1">
                    <TeamLine team={home} goals={hg} dim={done && hg < ag} />
                    <TeamLine team={away} goals={ag} dim={done && ag < hg} />
                </div>
                {!started && data.date_time && (
                    <div className="shrink-0 pl-3 border-l border-cw-border text-right">
                        <div className="text-base font-bold text-cw-text tabular-nums leading-tight">{timeOf(locale, data.date_time)}</div>
                        <div className="text-[11px] text-cw-muted">{dayOf(locale, data.date_time)}</div>
                    </div>
                )}
            </div>
            {canOpen && (
                <button type="button" onClick={open}
                    className="group w-full flex items-center justify-center gap-1 border-t border-cw-border py-1.5 text-xs font-semibold text-cw-primary hover:bg-cw-primary hover:text-cw-on-primary transition-colors">
                    {t('openEvent')}
                    <span className="transition-transform group-hover:translate-x-0.5">›</span>
                </button>
            )}
        </div>
    );
}
