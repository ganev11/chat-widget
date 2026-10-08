/** @jsxImportSource preact */
// The frame around the chat: a floating launcher with a pop-up panel (full screen on phones), or
// the panel filling the host's own container (inline). State the host can change at runtime
// (open, language, user) comes from the instance's store.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { I18nContext, createI18n } from '../i18n/index.js';
import { Chat } from './Chat.jsx';
import { ChatIcon, CloseIcon } from './icons.jsx';

const useStore = (store) => {
    const [state, setState] = useState(store.get());
    useEffect(() => store.subscribe(setState), [store]);
    return state;
};

// Phones get the whole screen; anything wider a panel by the launcher.
const useNarrow = () => {
    const query = '(max-width: 639px)';
    const [narrow, setNarrow] = useState(() => !!globalThis.matchMedia?.(query).matches);
    useEffect(() => {
        const mq = globalThis.matchMedia?.(query);
        if (!mq) return undefined;
        const on = () => setNarrow(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);
    return narrow;
};

function Launcher({ open, onClick, icon, label }) {
    return (
        <button type="button" onClick={onClick} aria-label={label} title={label} aria-expanded={open}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-cw-primary text-cw-on-primary shadow-[0_6px_20px_rgba(0,0,0,0.25)] hover:bg-cw-primary-hover transition-transform hover:scale-105 overflow-hidden">
            {open
                ? <CloseIcon className="w-6 h-6" />
                : icon ? <img src={icon} alt="" className="w-full h-full object-cover" /> : <ChatIcon className="w-7 h-7" />}
        </button>
    );
}

export function Widget({ store, client, storage, config, emit }) {
    const { open, language, userId, reset } = useStore(store);
    const i18n = useMemo(() => createI18n({ language, locale: config.locale, translations: config.translations }), [language]);
    const narrow = useNarrow();
    // Mounted from the first open and only hidden on close: an answer keeps streaming while the
    // panel is closed, and reopening does not reload the conversation.
    const [mounted, setMounted] = useState(open);
    useEffect(() => { if (open) setMounted(true); }, [open]);
    const onAction = (action) => {
        emit({ type: 'action', action: action.action });
        config.onAction?.(action);
    };

    const chat = (onClose) => (
        <Chat key={`${userId}:${reset ?? 0}`} client={client} storage={storage} userId={userId} language={language} options={config}
            onAction={onAction} emit={emit} onClose={onClose} />
    );

    if (config.mode === 'inline') {
        return <I18nContext.Provider value={i18n}><div className="h-full">{chat(null)}</div></I18nContext.Provider>;
    }

    const left = config.position === 'bottom-left';
    const { x = 20, y = 20 } = config.offset ?? {};
    const corner = { bottom: `${y}px`, [left ? 'left' : 'right']: `${x}px` };
    const close = () => store.set({ open: false });

    return (
        <I18nContext.Provider value={i18n}>
            {mounted && (
                <div role="dialog" aria-label={config.title ?? i18n.t('title')} hidden={!open}
                    className={!open ? 'hidden' : narrow
                        ? 'fixed inset-0 flex flex-col'
                        : 'fixed flex flex-col w-[400px] h-[min(680px,calc(100vh-120px))] rounded-[16px] overflow-hidden border border-cw-border shadow-[0_12px_40px_rgba(0,0,0,0.25)]'}
                    style={{ zIndex: config.zIndex, ...(narrow ? {} : { ...corner, bottom: `${y + 72}px` }) }}>
                    {chat(close)}
                </div>
            )}
            {!(open && narrow) && (
                <div className="fixed" style={{ zIndex: config.zIndex, ...corner }}>
                    <Launcher open={open} icon={config.launcherIcon} label={i18n.t(open ? 'closeChat' : 'openChat')}
                        onClick={() => store.set({ open: !open })} />
                </div>
            )}
        </I18nContext.Provider>
    );
}
