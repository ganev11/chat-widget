/** @jsxImportSource preact */
// The conversation panel: header, welcome prompts, the turns (the user's message, the streamed
// answer, its items), follow-up suggestions and the input. The same panel serves the floating and
// the inline mode; only the frame around it differs (Widget.jsx).
//
// One conversation per user: its chat_id is kept in the browser and the conversation is loaded
// back from the chat API on the next visit. "Clear chat" forgets it and starts a new one.
import { useEffect, useRef, useState } from 'preact/hooks';
import { newId } from '../api.js';
import { useI18n } from '../i18n/index.js';
import { ChatItems, visibleItems } from '../renderers/ChatItems.jsx';
import { Markdown } from '../renderers/Markdown.jsx';
import { BotIcon, CloseIcon, SendIcon, TrashIcon } from './icons.jsx';

const MAX_MESSAGE = 2000;

const Avatar = ({ src }) => (
    <span className="w-9 h-9 shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-cw-primary text-cw-on-primary">
        {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <BotIcon className="w-5 h-5" />}
    </span>
);

const Dots = () => <span className="cw-dots inline-flex items-center"><span /><span /><span /></span>;

function Header({ title, subtitle, avatar, onClear, onClose, canClear }) {
    const { t } = useI18n();
    return (
        <div className="flex items-center gap-3 px-4 py-3 bg-cw-header text-cw-on-header border-b border-cw-border">
            <Avatar src={avatar} />
            <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold leading-tight truncate">{title}</div>
                {subtitle && <div className="text-xs opacity-70 truncate">{subtitle}</div>}
            </div>
            {canClear && (
                <button type="button" onClick={onClear} title={t('clearChat')} aria-label={t('clearChat')}
                    className="p-1.5 rounded-full opacity-70 hover:opacity-100 hover:bg-cw-surface-alt">
                    <TrashIcon className="w-[18px] h-[18px]" />
                </button>
            )}
            {onClose && (
                <button type="button" onClick={onClose} title={t('closeChat')} aria-label={t('closeChat')}
                    className="p-1.5 rounded-full opacity-70 hover:opacity-100 hover:bg-cw-surface-alt">
                    <CloseIcon className="w-5 h-5" />
                </button>
            )}
        </div>
    );
}

function ConfirmClear({ onConfirm, onCancel }) {
    const { t } = useI18n();
    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-6">
            <div role="alertdialog" className="w-full max-w-xs rounded-cw bg-cw-surface p-4 shadow-xl">
                <div className="text-sm text-cw-text">{t('clearConfirm')}</div>
                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded text-sm font-semibold text-cw-text bg-cw-surface-alt hover:bg-cw-surface-hover">{t('cancel')}</button>
                    <button type="button" onClick={onConfirm} className="px-3 py-1.5 rounded text-sm font-semibold bg-cw-primary text-cw-on-primary hover:bg-cw-primary-hover">{t('clear')}</button>
                </div>
            </div>
        </div>
    );
}

function Welcome({ text, prompts, onPick, disabled }) {
    return (
        <div className="space-y-3">
            <div className="rounded-cw rounded-tl-sm bg-cw-surface border border-cw-border px-3 py-2.5 text-sm text-cw-text">{text}</div>
            <div className="flex flex-col items-end gap-1.5">
                {prompts.map((p) => (
                    <button key={p} type="button" disabled={disabled} onClick={() => onPick(p)}
                        className="max-w-[85%] text-left px-3 py-1.5 rounded-full border border-cw-primary text-cw-primary text-[13px] font-medium hover:bg-cw-primary hover:text-cw-on-primary disabled:opacity-40 transition-colors">
                        {p}
                    </button>
                ))}
            </div>
        </div>
    );
}

function Turn({ turn, onAction, onRetry }) {
    const { t } = useI18n();
    return (
        <div className="space-y-2">
            <div className="flex justify-end">
                <div className="max-w-[85%] px-3 py-2 rounded-cw rounded-br-sm bg-cw-user text-cw-on-user text-sm whitespace-pre-wrap break-words">{turn.input.text}</div>
            </div>
            {turn.live && (
                <div className="space-y-1">
                    {turn.live.status && (
                        <div className="flex items-center gap-2 text-xs text-cw-muted">
                            <Dots /><span>{turn.live.status}</span>
                        </div>
                    )}
                    {turn.live.text && <Markdown text={turn.live.text} />}
                </div>
            )}
            {turn.response && (
                <div className="space-y-2">
                    <Markdown text={turn.response.text} />
                    <ChatItems items={visibleItems(turn.response.ui)} onAction={onAction} reveal={!!turn.fresh} />
                </div>
            )}
            {turn.error && (
                <div className="flex items-center gap-2 text-sm text-cw-danger">
                    <span>{turn.error}</span>
                    {onRetry && <button type="button" onClick={onRetry} className="font-semibold underline hover:no-underline">{t('retry')}</button>}
                </div>
            )}
        </div>
    );
}

export function Chat({ client, storage, userId, language, options, onAction, emit, onClose }) {
    const { t } = useI18n();
    const [chatId, setChatId] = useState(null);
    const [turns, setTurns] = useState([]);           // { key, input, response?, live?, error?, fresh? }
    const [suggestions, setSuggestions] = useState([]);
    const [busy, setBusy] = useState(false);
    const [text, setText] = useState('');
    const [confirming, setConfirming] = useState(false);
    const scroller = useRef(null);
    const input = useRef(null);
    const pinned = useRef(true); // follow the stream only while the user is at the bottom
    const abort = useRef(null);

    // The user's conversation, loaded back from the API (or a fresh one).
    useEffect(() => {
        abort.current?.abort();
        setTurns([]);
        setSuggestions([]);
        setBusy(false);
        const id = storage.chatId(userId);
        setChatId(id);
        if (!id) return undefined;
        const ctrl = new AbortController();
        client.get(`/chat/chats/${encodeURIComponent(id)}`, { signal: ctrl.signal })
            .then((chat) => {
                setTurns(chat.turns.map((x) => ({
                    key: x.turn_id,
                    input: x.input,
                    response: x.response,
                    error: x.status === 'error' ? t('errorFailed') : null,
                })));
                setSuggestions(chat.turns.at(-1)?.response?.suggestions ?? []);
            })
            .catch((e) => {
                if (e.name === 'AbortError') return;
                // Gone or not ours any more: start over.
                if (e.status === 404 || e.status === 403) storage.setChatId(userId, null);
                setChatId(null);
            });
        return () => ctrl.abort();
    }, [userId]);

    useEffect(() => () => abort.current?.abort(), []);

    // The input grows with its text; back to one line once sent.
    useEffect(() => {
        const el = input.current;
        if (!el) return;
        el.style.height = 'auto';
        if (text) el.style.height = `${el.scrollHeight}px`;
    }, [text]);

    useEffect(() => {
        const el = scroller.current;
        if (el && pinned.current) el.scrollTop = el.scrollHeight;
    }, [turns, suggestions]);

    const onScroll = () => {
        const el = scroller.current;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };

    const patchLast = (fn) => setTurns((ts) => ts.map((x, i) => (i === ts.length - 1 ? { ...x, ...fn(x) } : x)));

    const errorText = (e) => {
        if (e.status === 409) return t('errorRunning');
        if (e.status === 429) return t('errorBusy');
        if (e.status === 401 || e.status === 403) return t('errorUnavailable');
        return t('errorFailed');
    };

    const send = async ({ message, suggestion }, { retried } = {}) => {
        const msg = message?.trim();
        if (busy || (!msg && !suggestion)) return;
        setBusy(true);
        setSuggestions([]);
        setText('');
        pinned.current = true;
        if (!retried) {
            setTurns((ts) => [...ts, {
                key: newId(),
                input: { text: msg ?? suggestion.label, via: suggestion ? 'suggestion' : 'message' },
                live: { text: '', status: t('sending') },
            }]);
        }
        emit({ type: 'message_sent', chat_id: chatId, text: msg ?? suggestion.label, via: suggestion ? 'suggestion' : 'message' });

        const ctrl = new AbortController();
        abort.current = ctrl;
        let finished = false;
        let restart = false;
        try {
            await client.ask(
                {
                    ...(chatId && { chat_id: chatId }),
                    ...(suggestion ? { suggestion_id: suggestion.suggestion_id } : { message: msg }),
                    ext_user_id: userId,
                    ext_message_id: newId(),
                    language,
                    ...(options.metadata && { ext_metadata: options.metadata }),
                },
                (type, data) => {
                    if (type === 'queued') patchLast((x) => ({ live: { ...x.live, status: t('queued', { position: data.position }) } }));
                    else if (type === 'started') {
                        if (data.chat_id && data.chat_id !== chatId) {
                            setChatId(data.chat_id);
                            storage.setChatId(userId, data.chat_id);
                        }
                        patchLast((x) => ({ live: { ...x.live, status: t('thinking') } }));
                    } else if (type === 'text.delta') patchLast((x) => ({ live: { text: x.live.text + data.text, status: null } }));
                    else if (type === 'text.reset') patchLast((x) => ({ live: { text: '', status: t('thinking') } }));
                    else if (type === 'done') {
                        finished = true;
                        setChatId(data.chat_id);
                        storage.setChatId(userId, data.chat_id);
                        // fresh: its betslips play the slot-machine reveal (loaded turns do not).
                        patchLast(() => ({ live: null, fresh: true, response: { text: data.text, ui: data.ui, suggestions: data.suggestions } }));
                        setSuggestions(data.suggestions ?? []);
                        emit({ type: 'answer', chat_id: data.chat_id, turn_id: data.turn_id });
                    } else if (type === 'queue_timeout') {
                        finished = true;
                        patchLast(() => ({ live: null, error: t('errorBusy') }));
                        emit({ type: 'error', code: 'queue_timeout' });
                    } else if (type === 'error') {
                        finished = true;
                        if (data.chat_id) {
                            setChatId(data.chat_id);
                            storage.setChatId(userId, data.chat_id);
                        }
                        patchLast(() => ({ live: null, error: t('errorFailed') }));
                        emit({ type: 'error', code: 'turn_failed', message: data.message });
                    }
                },
                { signal: ctrl.signal },
            );
            if (!finished) patchLast(() => ({ live: null, error: t('errorConnection') }));
        } catch (e) {
            if (e.name === 'AbortError') return;
            // The stored chat is gone (or belonged to another user): ask again in a new chat.
            if (e.status === 404 && chatId && !retried) restart = true;
            else {
                patchLast(() => ({ live: null, error: errorText(e) }));
                emit({ type: 'error', code: 'http', status: e.status ?? null, message: e.message });
            }
        } finally {
            setBusy(false);
        }
        if (restart) {
            storage.setChatId(userId, null);
            setChatId(null);
            // chatId is read from the closure: resend through a fresh render.
            setTimeout(() => retryRef.current?.({ message: msg ?? suggestion.label }, { retried: true }), 0);
        }
    };
    const retryRef = useRef(null);
    retryRef.current = send;

    // A failed turn is dropped and its text sent again as a message (a clicked suggestion is
    // spent on the server, its label still works as a question).
    const retry = (turn) => {
        setTurns((ts) => ts.filter((x) => x !== turn));
        send({ message: turn.input.text });
    };

    const clear = () => {
        abort.current?.abort();
        storage.setChatId(userId, null);
        setChatId(null);
        setTurns([]);
        setSuggestions([]);
        setBusy(false);
        setConfirming(false);
        emit({ type: 'clear' });
    };

    const submit = (e) => {
        e.preventDefault();
        send({ message: text });
    };
    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) submit(e);
    };

    const prompts = options.prompts ?? [t('prompt1'), t('prompt2'), t('prompt3'), t('prompt4')];
    const disclaimer = options.disclaimer === false ? null : (options.disclaimer ?? t('disclaimer'));
    const lastError = turns.at(-1)?.error ? turns.at(-1) : null;

    return (
        <div className="cw-chat relative flex flex-col h-full min-h-0 bg-cw-bg text-cw-text">
            <Header title={options.title ?? t('title')} subtitle={options.subtitle ?? t('subtitle')} avatar={options.avatar}
                canClear={turns.length > 0} onClear={() => setConfirming(true)} onClose={onClose} />

            <div ref={scroller} onScroll={onScroll} className="cw-scroll flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-5">
                {!turns.length && <Welcome text={options.welcome ?? t('welcome')} prompts={prompts} disabled={busy} onPick={(p) => send({ message: p })} />}
                {turns.map((x) => (
                    <Turn key={x.key} turn={x} onAction={onAction} onRetry={x === lastError && !busy ? () => retry(x) : null} />
                ))}
            </div>

            {suggestions.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto cw-scroll px-3 pb-2 pt-1">
                    {suggestions.map((s) => (
                        <button key={s.suggestion_id} type="button" disabled={busy} onClick={() => send({ suggestion: s })}
                            className="shrink-0 px-3 py-1 rounded-full border border-cw-primary text-cw-primary text-xs font-medium hover:bg-cw-primary hover:text-cw-on-primary disabled:opacity-40 transition-colors">
                            {s.label}
                        </button>
                    ))}
                </div>
            )}

            <form onSubmit={submit} className="flex items-end gap-2 px-3 pt-2 pb-2 border-t border-cw-border bg-cw-surface">
                <textarea
                    ref={input}
                    rows={1}
                    className="flex-1 min-w-0 resize-none max-h-28 bg-cw-surface-alt rounded-cw px-3 py-2 text-sm text-cw-text placeholder:text-cw-subtle outline-none focus:ring-2 focus:ring-cw-primary/40"
                    placeholder={t('placeholder')}
                    maxLength={MAX_MESSAGE}
                    value={text}
                    onInput={(e) => setText(e.target.value)}
                    onKeyDown={onKeyDown}
                    aria-label={t('placeholder')}
                />
                <button type="submit" disabled={busy || !text.trim()} title={t('send')} aria-label={t('send')}
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-cw-primary text-cw-on-primary hover:bg-cw-primary-hover disabled:opacity-40">
                    <SendIcon className="w-[18px] h-[18px]" />
                </button>
            </form>
            {disclaimer && <div className="px-3 pb-2 bg-cw-surface text-center text-[10px] text-cw-subtle">{disclaimer}</div>}

            {confirming && <ConfirmClear onConfirm={clear} onCancel={() => setConfirming(false)} />}
        </div>
    );
}
