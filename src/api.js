// Client of the SSTrader chat API — everything the widget sends and receives goes through here,
// so this file is also the shortest description of the API for anyone building their own client.
//
//   POST {apiUrl}/chat                 ask; with Accept: text/event-stream the answer streams as SSE
//        { chat_id?, message | suggestion_id, ext_user_id, ext_message_id?, ext_metadata?, language? }
//   GET  {apiUrl}/chat/chats/:chat_id  a conversation as the client received it (restore on reload)
//
// Auth: the sportsbook's public API key as a Bearer token. The key identifies the sportsbook and
// only works from its own sites (the browser's Origin is checked against the key's origins).
//
// Stream events: queued { position } · queue_timeout · started · text.delta { text } ·
// text.reset (drop the text streamed so far) · ui { items } · suggestions { items } ·
// done { chat_id, turn_id, text, ui, suggestions } (replaces everything streamed) · error { message }.
// EventSource cannot POST or send headers, hence fetch + a small SSE parser.

export class ChatApiError extends Error {
    constructor(status, message, data) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

export function createClient({ apiUrl, apiKey }) {
    const root = apiUrl.replace(/\/+$/, '');
    const headers = (extra = {}) => ({ Authorization: `Bearer ${apiKey}`, ...extra });

    const fail = async (res) => {
        const data = await res.json().catch(() => ({}));
        return new ChatApiError(res.status, data.error ?? `HTTP ${res.status}`, data);
    };

    return {
        // GET JSON. Throws ChatApiError on HTTP errors.
        async get(path, { signal } = {}) {
            const res = await fetch(root + path, { headers: headers(), signal });
            if (!res.ok) throw await fail(res);
            return res.json();
        },

        // POST /chat as a stream: onEvent(type, data) per event. Resolves when the stream ends.
        async ask(body, onEvent, { signal } = {}) {
            const res = await fetch(`${root}/chat`, {
                method: 'POST',
                headers: headers({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
                body: JSON.stringify(body),
                signal,
            });
            if (!res.ok) throw await fail(res);
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
                let i;
                while ((i = buf.indexOf('\n\n')) >= 0) {
                    const block = buf.slice(0, i);
                    buf = buf.slice(i + 2);
                    let type = 'message';
                    const data = [];
                    for (const line of block.split('\n')) {
                        if (line.startsWith('event:')) type = line.slice(6).trim();
                        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
                    }
                    if (!data.length) continue; // keep-alive comment
                    let parsed;
                    try { parsed = JSON.parse(data.join('\n')); } catch { parsed = data.join('\n'); }
                    onEvent(type, parsed);
                }
            }
        },
    };
}

// An id the service uses to recognise a retried send.
export const newId = () => (globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
