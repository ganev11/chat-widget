// What the widget keeps in the visitor's browser — nothing else is stored client-side:
//   visitor id   an anonymous id (when the site gives no user id), so a returning visitor keeps
//                their conversation
//   chat id      the current conversation per user; the conversation itself is loaded from the
//                chat API (GET /chat/chats/:chat_id), never stored here
//   open         whether the floating panel was open (sessionStorage), so it stays open across
//                page loads of one visit
// Keys are namespaced by a hash of the API key, so two widgets on one site do not collide.
// Storage can be blocked (private mode, cookie settings): every access is guarded and the widget
// then simply forgets on reload.
import { newId } from './api.js';

const hash = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
};

const read = (store, key) => { try { return store()?.getItem(key) ?? null; } catch { return null; } };
const write = (store, key, value) => {
    try {
        if (value == null) store()?.removeItem(key);
        else store()?.setItem(key, value);
    } catch { /* blocked storage: nothing kept */ }
};
const local = () => globalThis.localStorage;
const session = () => globalThis.sessionStorage;

export function createStorage(apiKey) {
    const ns = `sstchat:${hash(apiKey)}`;
    return {
        visitorId() {
            let id = read(local, `${ns}:visitor`);
            if (!id) {
                id = `v_${newId()}`;
                write(local, `${ns}:visitor`, id);
            }
            return id;
        },
        chatId: (userId) => read(local, `${ns}:chat:${userId}`),
        setChatId: (userId, chatId) => write(local, `${ns}:chat:${userId}`, chatId),
        wasOpen: () => read(session, `${ns}:open`) === '1',
        setOpen: (open) => write(session, `${ns}:open`, open ? '1' : null),
    };
}
