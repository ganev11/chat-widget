/** @jsxImportSource preact */
// Match-statistic icons, bundled into the widget (it cannot load files from the host's site).
// They are drawn for a dark background in white; inline, their white is swapped for currentColor
// so they follow the theme's text colour. Their own colours (yellow/red cards, gold) stay.
import { useMemo } from 'preact/hooks';
import attacks from '../assets/stats/attacks.svg?raw';
import ballPossession from '../assets/stats/ball_possession.svg?raw';
import corners from '../assets/stats/corners.svg?raw';
import dangerousAttacks from '../assets/stats/dangerous_attacks.svg?raw';
import expectedGoals from '../assets/stats/expected_goals.svg?raw';
import goals from '../assets/stats/goals.svg?raw';
import penalties from '../assets/stats/penalties.svg?raw';
import pressureIndex from '../assets/stats/pressure_index.svg?raw';
import redcards from '../assets/stats/redcards.svg?raw';
import shotsOffTarget from '../assets/stats/shots_off_target.svg?raw';
import shotsOnTarget from '../assets/stats/shots_on_target.svg?raw';
import shotsTotal from '../assets/stats/shots_total.svg?raw';
import substitutions from '../assets/stats/substitutions.svg?raw';
import yellowcards from '../assets/stats/yellowcards.svg?raw';

const clean = (svg) => svg
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/#FFFFFF\b/gi, 'currentColor')
    .replace(/<svg\b/, '<svg width="100%" height="100%"')
    .trim();

const ICONS = Object.fromEntries(Object.entries({
    GOALS: goals,
    SHOTS_ON_TARGET: shotsOnTarget,
    SHOTS_OFF_TARGET: shotsOffTarget,
    SHOTS_TOTAL: shotsTotal,
    CORNERS: corners,
    BALL_POSSESSION: ballPossession,
    ATTACKS: attacks,
    DANGEROUS_ATTACKS: dangerousAttacks,
    YELLOWCARDS: yellowcards,
    REDCARDS: redcards,
    PENALTIES: penalties,
    SUBSTITUTIONS: substitutions,
    EXPECTED_GOALS: expectedGoals,
    PRESSURE_INDEX: pressureIndex,
}).map(([k, v]) => [k, clean(v)]));

export const hasStatIcon = (name) => name in ICONS;

// Ids (clip paths) and the classes of each file's <style> (.st0, .st1 … in every file) are
// shared by the whole shadow root: each copy gets its own suffix, so no icon picks up another's
// definitions or colours.
let seq = 0;

export function StatIcon({ name, className = 'w-4 h-4', title }) {
    const html = useMemo(() => {
        const svg = ICONS[name];
        if (!svg) return null;
        const n = `cw${++seq}`;
        return svg
            .replace(/\bid="([^"]+)"/g, `id="$1-${n}"`)
            .replace(/url\(#([^)]+)\)/g, `url(#$1-${n})`)
            .replace(/href="#([^"]+)"/g, `href="#$1-${n}"`)
            .replace(/\bst(\d+)\b/g, `st$1-${n}`);
    }, [name]);
    if (!html) return null;
    // Our own bundled SVG files, never data from the chat.
    return <span className={`inline-block shrink-0 ${className}`} title={title} aria-hidden={title ? undefined : 'true'} dangerouslySetInnerHTML={{ __html: html }} />;
}
