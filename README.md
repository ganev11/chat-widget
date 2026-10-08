# SSTrader chat widget

An embeddable AI betting-insights chat for sportsbooks. Users ask about matches, odds, live
statistics and lineups, and get accas and bet builders built from SSTrader's prediction models.
Every pick can be added to **your** betslip with one click.

It is also the reference client of the SSTrader chat API. If you would rather build your own UI,
[`src/api.js`](src/api.js) is the whole protocol in about 100 lines. See also
[Building your own client](#building-your-own-client).

- One `<script>` tag, no dependencies, about 45 kB gzipped
- Floating chat button, or inline in your own container
- Rendered in a shadow root, so your CSS and the widget's never interact
- Branding through a theme of colours; built-in languages: Spanish, English, Bulgarian
- Streams answers; restores the conversation on the next visit

## Quick start

```html
<script src="https://YOUR-CDN/sst-chat.js"></script>
<script>
  SSTChat.init({
    apiKey: 'YOUR_PUBLIC_KEY',
    language: 'es',
    onAction(action) {
      if (action.action === 'add_to_betslip') {
        for (const s of action.selections) myBetslip.add(s.raw);   // your own selection ids
      }
    },
  });
</script>
```

Before the widget can be used from your site, we must add your site's origins (for example
`https://www.example.com`) to your API key. Requests from other origins are refused.

### Inline

```html
<div id="chat" style="height: 640px"></div>
<script>
  SSTChat.init({ apiKey: 'YOUR_PUBLIC_KEY', mode: 'inline', container: '#chat' });
</script>
```

Inline mode fills its container, so give the container a height.

### npm / bundlers

```js
import { init } from '@sstrader/chat-widget';
const chat = init({ apiKey: 'YOUR_PUBLIC_KEY' });
```

## Options

| Option | Default | |
|---|---|---|
| `apiKey` | — (required) | Your public API key. It identifies your sportsbook and only works from your origins. |
| `apiUrl` | `https://dev.sstrader.com/v1` | Chat API base URL. |
| `mode` | `'floating'` | `'floating'` (a chat button and pop-up panel; full screen on phones) or `'inline'`. |
| `container` | — | Inline mode: an element or a CSS selector. |
| `language` | `'en'` | `'es'`, `'en'`, `'bg'`, or any language you add in `translations`. It is also sent to the chat, which answers in that language unless the user writes in another one. |
| `locale` | `language` | Locale for dates and times, e.g. `'es-PE'`. |
| `translations` | — | Override any text, or add a language: `{ es: { title: 'Asistente' } }`. See [`src/i18n/en.js`](src/i18n/en.js) for every key. |
| `theme` | light preset | See [Theming](#theming). |
| `userId` | anonymous | Your own id for the logged-in user, used to keep their conversation. Without one, an anonymous id is kept in the browser. Change it at runtime with `setUser()`. |
| `title`, `subtitle`, `welcome` | translated | Header texts and the first message. |
| `avatar` | robot icon | Image URL for the header avatar. |
| `launcherIcon` | chat icon | Image URL for the floating button. |
| `prompts` | 4 translated examples | Starter questions shown in an empty chat (array of strings). |
| `disclaimer` | `'18+ · Bet responsibly'` (translated) | Footer line; `false` hides it. |
| `position` | `'bottom-right'` | `'bottom-left'` too. |
| `offset` | `{ x: 20, y: 20 }` | Distance of the button from the corner, in px. |
| `zIndex` | `2147483000` | |
| `open` | `false` | Start with the panel open. |
| `rememberOpen` | `true` | Keep the panel open across page loads within one visit. |
| `metadata` | — | An object sent with every message (`ext_metadata`) and visible to us when auditing, e.g. `{ site: 'web', page: 'live' }`. Max 4000 characters as JSON. |
| `onAction` | — | **Betslip integration**, see below. |
| `onEvent` | — | Analytics hook, see below. |

## Betslip integration: `onAction`

The widget never places bets and cannot see your betslip. When the user clicks a price or a
betslip button, it calls `onAction` with what was clicked, and your site does the rest.

```js
onAction(action) {
  switch (action.action) {
    case 'add_to_betslip':   // one or more selections (a single, or a whole acca)
      action.selections.forEach((s) => betslip.add(s.raw));
      break;
    case 'add_bet_builder':  // a bet builder, priced by you as one bet
      betslip.addBetBuilder(action.bet_builder.raw, action.fixture.integration);
      break;
    case 'open_event':       // the user wants to see the match on your site
      location.href = `/event/${action.integration.ext_event_id}`;
      break;
  }
}
```

| `action` | Payload |
|---|---|
| `add_to_betslip` | `selections`: odds rows. Each has `raw` (your own ids for the selection), plus `label_name`, `market_name`, `value` (the decimal price shown), `line`, `odd_id`. |
| `add_bet_builder` | `bet_builder`: `{ value, raw, selections }`, where `raw` is your bet builder reference. `fixture`: the match, including `integration`. |
| `open_event` | `fixture`, `fixture_id`, `integration` (your event ids, e.g. `ext_event_id`). |

Prices can change between the answer and the click, so re-price from your own feed when adding.

## Events: `onEvent`

`onEvent(event)` receives `{ type, … }`:

| `type` | |
|---|---|
| `ready` | The widget is mounted. |
| `open` / `close` | The floating panel opened or closed. |
| `message_sent` | `{ chat_id, text, via: 'message' \| 'suggestion' }` |
| `answer` | `{ chat_id, turn_id }`: an answer finished. |
| `action` | `{ action }`: a betslip or event button was clicked (also passed to `onAction`). |
| `clear` | The user cleared the conversation. |
| `error` | `{ code, status?, message? }` |

## Methods

`init()` returns an instance:

| | |
|---|---|
| `open()`, `close()`, `toggle()`, `isOpen()` | Floating mode. |
| `setLanguage('en')` | Switch the UI language. Answers follow from the next message. |
| `setUser(id)` | After login (`null` on logout). Each user has their own conversation. |
| `setTheme({ primary: '#123456' })` | Change colours at runtime. |
| `clearHistory()` | Start a new conversation. |
| `destroy()` | Remove the widget. |

## Theming

A theme is a flat object of colours. Start from a preset (`light`, the default, or `dark`) and
override what you need:

```js
SSTChat.init({
  apiKey: '…',
  theme: {
    preset: 'light',
    primary: '#0a7d32',        // brand colour: button, send, CTAs, tabs
    primaryHover: '#086428',
    userBubble: '#0a7d32',     // the user's own messages
    odds: '#0a7d32',           // prices
    fontFamily: 'Roboto, sans-serif',
    radius: '6px',
  },
});
```

All keys, with their defaults, are in [`src/theme.js`](src/theme.js): `primary`, `primaryHover`,
`onPrimary`, `background`, `surface`, `surfaceAlt`, `surfaceHover`, `border`, `text`,
`textMuted`, `textSubtle`, `odds`, `highlight`, `accent`, `success`, `danger`, `warning`, `live`,
`userBubble`, `userText`, `headerBackground`, `headerText`, `pitch`, `radius`, `fontFamily`.

## What is stored in the browser

- an anonymous visitor id (only when you pass no `userId`),
- the id of the current conversation per user (the conversation itself is loaded from the API),
- whether the panel was open, in `sessionStorage`.

Nothing else is stored. If storage is blocked, the widget works but forgets on reload.

## Building your own client

The chat API is plain HTTP and works with any stack:

```
POST {apiUrl}/chat
Authorization: Bearer YOUR_PUBLIC_KEY
Accept: text/event-stream            ← stream; omit it for one JSON response

{ "message": "Any bet builders for today?",
  "ext_user_id": "your-user-or-visitor-id",
  "ext_message_id": "a-unique-id",   ← a retry with the same id returns the same answer
  "language": "es",
  "chat_id": "…" }                   ← omit for a new conversation
```

A clicked suggestion is sent as `suggestion_id` instead of `message`. The stream carries
`queued { position }` (you are in line), `started { chat_id }`, `text.delta { text }`,
`text.reset` (drop the text so far), `ui`, `suggestions`, and finally
`done { chat_id, turn_id, text, ui, suggestions }`, which replaces everything streamed, or
`error`. The JSON form returns the `done` body.

`GET {apiUrl}/chat/chats/:chat_id` returns a conversation as your client received it.

`ui` is a list of items `{ ref, kind, data }`. The `kind` is one of `fixture`, `odd`, `odds`,
`betslip` (acca or bet builder), `lineups`, `form`, `insights`, `statistics`, `timeline` or
`predictions`. `data` holds our API's own rows, so each odd carries your `raw` ids.
[`src/renderers/`](src/renderers/) shows how each kind is drawn.

## Development

```
npm install
npm run dev      # http://localhost:5174/?key=YOUR_KEY&api=http://localhost:3005/v1
npm run build    # dist/sst-chat.js (script tag) and dist/sst-chat.mjs (ES module)
```

`index.html` is a demo sportsbook page with a betslip that receives `onAction`.
`demo/inline.html` shows inline mode with the dark preset. You can put the key and URL in
`.env.local` as `VITE_CHAT_API_KEY` and `VITE_CHAT_API_URL` instead of the query string.

The source is Preact and Tailwind CSS v4. The CSS is compiled into the bundle and injected into
the shadow root.

## License

ISC
