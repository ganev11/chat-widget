/** @jsxImportSource preact */
// Minimal markdown for chat answers: paragraphs, headings, bullet/numbered lists, **bold**,
// *italic* and `code`. Builds elements directly (no innerHTML), so model output cannot inject
// markup.

function inline(text, keyBase) {
    const out = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
    let last = 0;
    let m;
    let k = 0;
    while ((m = re.exec(text))) {
        if (m.index > last) out.push(text.slice(last, m.index));
        const t = m[0];
        const key = `${keyBase}-${k++}`;
        if (t.startsWith('**')) out.push(<strong key={key} className="font-semibold text-cw-text">{t.slice(2, -2)}</strong>);
        else if (t.startsWith('`')) out.push(<code key={key} className="px-1 rounded bg-cw-surface-alt text-xs">{t.slice(1, -1)}</code>);
        else out.push(<em key={key}>{t.slice(1, -1)}</em>);
        last = m.index + t.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}

export function Markdown({ text, className = '' }) {
    if (!text) return null;
    const blocks = [];
    let list = null;
    let para = [];
    const flushPara = () => {
        if (para.length) blocks.push({ type: 'p', text: para.join(' ') });
        para = [];
    };
    const flushList = () => {
        if (list) blocks.push(list);
        list = null;
    };

    for (const raw of text.split('\n')) {
        const line = raw.trim();
        const bullet = line.match(/^[-*•]\s+(.*)$/);
        const numbered = line.match(/^\d+[.)]\s+(.*)$/);
        const heading = line.match(/^(#{1,4})\s+(.*)$/);
        if (!line) { flushPara(); flushList(); continue; }
        if (heading) { flushPara(); flushList(); blocks.push({ type: 'h', text: heading[2] }); continue; }
        if (bullet || numbered) {
            flushPara();
            const type = bullet ? 'ul' : 'ol';
            if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
            list.items.push((bullet ?? numbered)[1]);
            continue;
        }
        flushList();
        para.push(line);
    }
    flushPara();
    flushList();

    return (
        <div className={`space-y-2 text-sm leading-relaxed text-cw-text ${className}`}>
            {blocks.map((b, i) => {
                if (b.type === 'h') return <div key={i} className="font-semibold">{inline(b.text, i)}</div>;
                if (b.type === 'p') return <p key={i}>{inline(b.text, i)}</p>;
                const Tag = b.type;
                return (
                    <Tag key={i} className={`${b.type === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 space-y-1`}>
                        {b.items.map((it, j) => <li key={j}>{inline(it, `${i}-${j}`)}</li>)}
                    </Tag>
                );
            })}
        </div>
    );
}
