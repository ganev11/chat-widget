/** @jsxImportSource preact */
// SSTrader chat widget — public API.
//
//   const chat = SSTChat.init({
//     apiKey: 'pk_…',                       // the sportsbook's public key (required)
//     mode: 'floating',                     // or 'inline' with container: '#chat'
//     language: 'es',
//     theme: { primary: '#0a7d32' },
//     onAction: (a) => { … },               // add_to_betslip / add_bet_builder / open_event
//   });
//   chat.open(); chat.setUser('12345'); chat.setLanguage('en'); chat.clearHistory(); chat.destroy();
//
// The widget renders into a shadow root: its styles never touch the page and the page's styles
// never reach in. See README.md for every option.
import { render } from 'preact';
import { createClient } from './api.js';
import { createStorage } from './storage.js';
import { themeStyle } from './theme.js';
import { Widget } from './ui/Widget.jsx';
import css from './styles/widget.css?inline';

export { presets } from './theme.js';
export { languages } from './i18n/index.js';
export const version = '0.1.0';

const DEFAULTS = {
    apiUrl: 'https://dev.sstrader.com/v1',
    mode: 'floating',
    language: 'en',
    position: 'bottom-right',
    zIndex: 2147483000,
};

// Tailwind sizes in rem would follow the host page's root font size (some sites set 62.5%):
// pin them to px. And @property rules are ignored inside a shadow root, so they go to the page
// once — they only register --tw-* custom properties.
const shadowCss = css.replace(/(-?\d*\.?\d+)rem\b/g, (_, n) => `${+(n * 16).toFixed(3)}px`);
function installProperties() {
    if (document.getElementById('sst-chat-properties')) return;
    const rules = css.match(/@property\s+--tw-[\w-]+\s*\{[^}]*\}/g);
    if (!rules) return;
    const style = document.createElement('style');
    style.id = 'sst-chat-properties';
    style.textContent = rules.join('\n');
    document.head.appendChild(style);
}

function createStore(initial) {
    let state = initial;
    const subs = new Set();
    return {
        get: () => state,
        set(patch) {
            state = { ...state, ...patch };
            subs.forEach((fn) => fn(state));
        },
        subscribe(fn) {
            subs.add(fn);
            return () => subs.delete(fn);
        },
    };
}

export function init(options = {}) {
    const config = { ...DEFAULTS, ...options };
    if (!config.apiKey) throw new Error('SSTChat.init: apiKey is required');
    if (config.mode !== 'floating' && config.mode !== 'inline') throw new Error(`SSTChat.init: unknown mode '${config.mode}'`);

    let container = null;
    if (config.mode === 'inline') {
        container = typeof config.container === 'string' ? document.querySelector(config.container) : config.container;
        if (!container) throw new Error('SSTChat.init: inline mode needs a container (element or selector)');
    }

    const emit = (event) => {
        try { config.onEvent?.(event); } catch (e) { console.error('[sst-chat] onEvent', e); }
    };
    const client = createClient({ apiUrl: config.apiUrl, apiKey: config.apiKey });
    const storage = createStorage(config.apiKey);
    const userOf = (id) => (id != null && id !== '' ? String(id).slice(0, 128) : storage.visitorId());
    const store = createStore({
        open: config.mode === 'inline' || !!config.open || (config.rememberOpen !== false && storage.wasOpen()),
        language: config.language,
        userId: userOf(config.userId),
    });

    installProperties();
    const host = document.createElement('div');
    host.setAttribute('data-sst-chat', '');
    if (container) {
        host.style.cssText = 'display:block;width:100%;height:100%;';
        container.appendChild(host);
    } else {
        document.body.appendChild(host);
    }
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = shadowCss;
    const root = document.createElement('div');
    root.className = 'cw-root';
    if (container) root.style.height = '100%';
    const applyTheme = (theme) => {
        for (const [k, v] of Object.entries(themeStyle(theme))) root.style.setProperty(k, v);
    };
    applyTheme(config.theme);
    shadow.append(style, root);

    let wasOpen = store.get().open;
    const unsubscribe = store.subscribe((s) => {
        if (s.open === wasOpen) return;
        wasOpen = s.open;
        if (config.mode === 'floating') storage.setOpen(s.open);
        emit({ type: s.open ? 'open' : 'close' });
    });

    render(<Widget store={store} client={client} storage={storage} config={config} emit={emit} />, root);
    emit({ type: 'ready' });

    let destroyed = false;
    return {
        open: () => store.set({ open: true }),
        close: () => config.mode === 'floating' && store.set({ open: false }),
        toggle: () => config.mode === 'floating' && store.set({ open: !store.get().open }),
        isOpen: () => store.get().open,
        // es | en | bg, or any language given in `translations`. Answers follow from the next message.
        setLanguage: (language) => store.set({ language }),
        // The site's own user id after login (null on logout → back to the anonymous visitor).
        // Each user has their own conversation.
        setUser: (id) => store.set({ userId: userOf(id) }),
        // Theme overrides on top of the current preset, e.g. setTheme({ primary: '#123456' }).
        setTheme: (theme) => applyTheme({ ...config.theme, ...theme }),
        // Forget the current conversation (the next message starts a new one).
        clearHistory: () => {
            storage.setChatId(store.get().userId, null);
            store.set({ reset: Date.now() });
            emit({ type: 'clear' });
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            unsubscribe();
            render(null, root);
            host.remove();
        },
    };
}
