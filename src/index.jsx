/** @jsxImportSource preact */
// SSTrader chat widget — public API.
//
//   const chat = SSTChat.init({
//     apiKey: 'pk_…',                       // the sportsbook's public key (required)
//     mode: 'floating',                     // or 'inline' with container: '#chat'
//     language: 'es',
//     oddsFormat: 'decimal',                // or 'fractional' (5/2)
//     jurisdiction: 'GB',                   // safer-gambling rules for the customer's country
//     customerStatus: 'ok',                 // or 'restricted' (self-excluded, time-out …)
//     theme: { primary: '#0a7d32' },
//     onAction: (a) => { … },               // add_to_betslip / add_bet_builder / open_event
//   });
//   chat.open(); chat.setUser('12345'); chat.setLanguage('en'); chat.clearHistory(); chat.destroy();
//   chat.setCustomerStatus('restricted'); chat.setJurisdiction('GB'); chat.setOddsFormat('fractional');
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
    oddsFormat: 'decimal',
    customerStatus: 'ok',
};

const ODDS_FORMATS = ['decimal', 'fractional'];
const CUSTOMER_STATUSES = ['ok', 'restricted'];
const check = (name, value, allowed) => {
    if (!allowed.includes(value)) throw new Error(`SSTChat: ${name} must be ${allowed.join(' or ')} (got '${value}')`);
    return value;
};
// A jurisdiction code ('GB') — which ones have rules is the chat service's business; it answers
// 400 for one it does not know.
const jurisdictionOf = (code) => (code ? String(code).toUpperCase() : null);

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
    check('oddsFormat', config.oddsFormat, ODDS_FORMATS);
    check('customerStatus', config.customerStatus, CUSTOMER_STATUSES);

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
        oddsFormat: config.oddsFormat,
        jurisdiction: jurisdictionOf(config.jurisdiction),
        customerStatus: config.customerStatus,
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
        // decimal | fractional — the cards at once, the answers' text from the next message.
        setOddsFormat: (format) => store.set({ oddsFormat: check('oddsFormat', format, ODDS_FORMATS) }),
        // The customer's jurisdiction ('GB'; null for none): the chat service applies its
        // safer-gambling rules from the next message.
        setJurisdiction: (code) => store.set({ jurisdiction: jurisdictionOf(code) }),
        // ok | restricted (self-excluded, time-out, cooling-off …): a restricted customer gets no
        // betting content. With a jurisdiction only. Set it from the sportsbook's own account state.
        setCustomerStatus: (status) => store.set({ customerStatus: check('customerStatus', status, CUSTOMER_STATUSES) }),
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
