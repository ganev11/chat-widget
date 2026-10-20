// Odds formats: the API's prices are decimal; `oddsFormat: 'fractional'` prints them the UK/Irish
// way. The chat service has the same conversion for the prices the model writes in its answer —
// keep the two in step so the text and the cards agree.

// The traditional ladder: a rounded decimal (1.44) is printed as a bookmaker prints it (4/9),
// not as its exact fraction (11/25).
const LADDER = (
    '1/100 1/66 1/50 1/40 1/33 1/25 1/20 1/16 1/14 1/12 1/10 1/9 1/8 2/15 1/7 2/13 1/6 2/11 1/5 2/9 '
    + '1/4 2/7 3/10 1/3 4/11 2/5 4/9 1/2 8/15 4/7 8/13 4/6 8/11 4/5 5/6 10/11 1/1 21/20 11/10 6/5 5/4 '
    + '11/8 7/5 6/4 8/5 13/8 7/4 9/5 15/8 2/1 85/40 11/5 9/4 12/5 5/2 13/5 11/4 3/1 16/5 10/3 7/2 4/1 '
    + '9/2 5/1 11/2 6/1 13/2 7/1 15/2 8/1 17/2 9/1 10/1 11/1 12/1 14/1 16/1 18/1 20/1 22/1 25/1 28/1 '
    + '33/1 40/1 50/1 66/1 80/1 100/1 125/1 150/1 200/1 250/1 300/1 400/1 500/1 750/1 1000/1 '
    + '9/20 11/20 3/5 7/10 3/4 17/20 9/10 19/20 23/20 13/10 17/10 19/10 21/10 23/10 14/5 29/10'
).split(' ').map((f) => {
    const [n, d] = f.split('/').map(Number);
    return { text: f, profit: n / d };
});

// 3.5 → "5/2". Off the ladder (an acca's total, 23.45) the closest fraction with a small
// denominator: "45/2".
export function toFractional(decimal) {
    const d = Number(decimal);
    if (!Number.isFinite(d) || d <= 1) return decimal;
    const profit = d - 1;
    let best = LADDER[0];
    for (const step of LADDER) if (Math.abs(step.profit - profit) < Math.abs(best.profit - profit)) best = step;
    // Close enough: within 2%, or within 0.015 for short prices (1.41 → 2/5, as printed).
    const gap = Math.abs(best.profit - profit);
    if (gap / profit <= 0.02 || gap <= 0.015) return best.text;
    for (const den of [1, 2, 4, 5, 10, 20, 25, 50, 100]) {
        const num = Math.round(profit * den);
        if (num > 0 && Math.abs(num / den - profit) / profit <= 0.005) return `${num}/${den}`;
    }
    return `${Math.round(profit * 100)}/100`;
}

const decimal = (v) => (typeof v === 'number' ? v.toFixed(2) : v);

// The price formatter for an odds format ('decimal' | 'fractional').
export const priceFormatter = (format) => (format === 'fractional'
    ? (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? v : toFractional(v))
    : decimal);
