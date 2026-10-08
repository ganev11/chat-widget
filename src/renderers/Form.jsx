/** @jsxImportSource preact */
// Recent form (get_fixture form section): each side's last five finished games as tiles, oldest
// to latest, with a points / goals summary. `data.home|away` = { team_id, fixtures } where the
// fixtures are the API's own rows, newest first.
import { useI18n } from '../i18n/index.js';
import { Frame } from './MatchStats.jsx';
import { shortDay } from './util.js';

// Result colours are fixed (green/grey/red read the same in every theme).
const RESULT = {
    W: { key: 'win', tile: 'bg-[#2f9e44] text-white', bar: 'bg-[#2f9e44]', points: 3 },
    D: { key: 'draw', tile: 'bg-[#8a8a8a] text-white', bar: 'bg-[#8a8a8a]', points: 1 },
    L: { key: 'loss', tile: 'bg-[#d92d20] text-white', bar: 'bg-[#d92d20]', points: 0 },
};

function game(f, teamId) {
    const me = f.participants?.find((p) => p.id === teamId);
    const opp = f.participants?.find((p) => p.id !== teamId);
    const g = (team) => f.scores?.find((s) => s.team_id === team?.id && s.developer_name === 'CURRENT')?.value ?? 0;
    const [gf, ga] = [g(me), g(opp)];
    return { id: f.id, me, opp, gf, ga, home: me?.location === 'home', date: f.date_time, league: f.league?.name, r: gf > ga ? 'W' : gf < ga ? 'L' : 'D' };
}

function Tile({ g, latest }) {
    const { t, locale } = useI18n();
    const res = RESULT[g.r];
    const title = `${shortDay(locale, g.date)} · ${g.league ?? ''}\n${g.home ? `${g.me?.name} ${g.gf}–${g.ga} ${g.opp?.name}` : `${g.opp?.name} ${g.ga}–${g.gf} ${g.me?.name}`}`;
    return (
        <div title={title}
            className={`flex-1 min-w-0 rounded-md bg-cw-surface-alt overflow-hidden flex flex-col items-center pb-1 ${latest ? 'ring-1 ring-cw-muted' : ''}`}>
            <div className={`w-full h-0.5 ${res.bar}`} />
            <span className={`mt-1 w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${res.tile}`}>{t(res.key)}</span>
            <span className="mt-1 text-sm font-semibold text-cw-text tabular-nums">{g.gf}–{g.ga}</span>
            <span className="w-full px-1 text-center text-[10px] leading-tight text-cw-muted truncate">{g.opp?.name}</span>
            <span className="text-[9px] uppercase tracking-wide text-cw-subtle">{g.home ? t('home') : t('away')}</span>
        </div>
    );
}

function TeamForm({ side }) {
    const { t } = useI18n();
    // Oldest first, so the strip reads left to right towards the latest game.
    const games = side.fixtures.map((f) => game(f, side.team_id)).reverse();
    if (!games.length) return null;
    const name = games.find((g) => g.me)?.me?.name;
    const count = (r) => games.filter((g) => g.r === r).length;
    const points = games.reduce((n, g) => n + RESULT[g.r].points, 0);
    const gf = games.reduce((n, g) => n + g.gf, 0);
    const ga = games.reduce((n, g) => n + g.ga, 0);
    const pct = Math.round((points / (games.length * 3)) * 100);

    return (
        <div>
            <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium text-cw-text">{name}</span>
                <span className="shrink-0 text-[11px] text-cw-muted tabular-nums">
                    <span className="text-cw-success">{count('W')}{t('win')}</span> <span>{count('D')}{t('draw')}</span> <span className="text-cw-danger">{count('L')}{t('loss')}</span>
                    <span className="mx-1 text-cw-subtle">·</span>
                    {gf}:{ga}
                </span>
            </div>
            <div className="mt-1.5 flex gap-1">
                {games.map((g, i) => <Tile key={g.id} g={g} latest={i === games.length - 1} />)}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-cw-surface-alt overflow-hidden">
                    <div className="h-full rounded-full bg-cw-highlight" style={{ width: `${pct}%` }} />
                </div>
                <span className="shrink-0 text-[11px] text-cw-muted tabular-nums">{t('points', { points, max: games.length * 3 })}</span>
            </div>
        </div>
    );
}

export function Form({ data }) {
    const { t } = useI18n();
    const sides = ['home', 'away'].filter((s) => data[s]?.fixtures?.length);
    return (
        <Frame title={t('recentForm')}>
            {sides.length
                ? <div className="space-y-3 divide-y divide-cw-border/60 [&>*+*]:pt-3">{sides.map((s) => <TeamForm key={s} side={data[s]} />)}</div>
                : <div className="py-2 text-xs text-cw-subtle">{t('noRecentGames')}</div>}
        </Frame>
    );
}
