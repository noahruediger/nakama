# NAKAMA — notes for Claude

Noah's personal contacts app (CRM). Read this before changing anything.

## How it fits together

- **`index.html`** is the whole front end: one file holding HTML, CSS and one big JS IIFE. GitHub Pages serves `main` at https://noahruediger.github.io/nakama/. A push to `main` goes live about 10 minutes later. Check the repo's Actions tab ("pages build and deployment").
- **`apps-script/Code.gs`** is the backend. It is a Google Apps Script web app bound to the **NAKAMA Contacts** Google Sheet, which is the master copy of all data. Every request is a `POST` with a `text/plain` JSON body `{action, pin, ...}`. `handle_` rejects anything without the right PIN (stored in Script Properties). Reads (`READS`) skip the lock.
- **`vendor/romaji/`** holds kuroshiro and the kuromoji dictionary. `worker.js` runs in a Web Worker and turns Japanese names into romaji off the main thread. Keep `dictPath` relative (`'dict/'`), because kuromoji breaks full URLs. Don't load these from a CDN on the main thread: that froze the page.
- **Nightly Beeper sync** is a Claude scheduled task on Noah's account. It writes `nakama-sync-YYYY-MM-DD.json` into the Drive folder "NAKAMA Sync Inbox", and an hourly Apps Script trigger applies it. It never writes notes.
- **Photo inbox** photos live in the Drive folder "NAKAMA Photo Inbox" (`PHOTO_FOLDER_ID` script property). Contact photos are cropped 256px JPEG data URLs in the sheet's Photos tab (each under 49,000 characters).

## Hard rules (from Noah)

- **No contact data in this repo, ever.** It's public. The demo data inside `index.html` is fake and that's fine.
- **Never store app data on Noah's devices.** No localStorage, IndexedDB or downloaded files holding contacts or photos. Everything lives in the Sheet or Drive. The only things in localStorage are the backend URL, the PIN, and display preferences (theme, canvas physics, map style, demo dashboards). Keys start with `orbit.` or `nakama.`.
- **The Apps Script must never be usable without the PIN.** Never put the PIN or the `/exec` URL in the repo.
- Noah isn't a developer. Explain things in plain words and keep his workflow simple.

## Front-end conventions

- **Event delegation:** buttons carry `data-act="..."` (with `data-id`, `data-k` and so on) and are handled by the one big `switch` in the `click` listener under `/* ---------- events ---------- */`. Inputs use the `input`, `keydown` and `change` listeners nearby. The IIFE means inline `onclick=` handlers won't work.
- **Two matchers exist.** `renderMatcher()` (old, unused) and `renderMatcher2()` (live), and some markup is duplicated between them. When patching matcher markup with search-and-replace, make sure the change lands in `renderMatcher2`.
- **Saving in live mode:**
  - Edit the contact object in `CONTACTS`. `syncDirty()` runs after every click, change, keydown and drop.
  - It compares each contact with its snapshot (`SNAP`, via `markClean`) and sends a `batch` of `saveContact`, `savePhoto`, `log` and `deleteContact` ops through `enqueue()`. That feeds the "Sending N changes" list under Connected.
  - Use `enqueue(()=>api(...), ['label'])` for anything else.
- **Field mapping:** `toBackend(c)` (app → sheet) and `applyLive(data)` (sheet → app). The sheet column names are in `TABS.Contacts` and `FIELDS` in Code.gs. `saveContact_` adds missing columns by itself (`ensureCols_`).
- **Modals** go in `#modalRoot` and the side drawer in `#drawerRoot`. If you re-render a modal while it's open, add the `still` class to `.scrim` (see `_still` in `renderMerge`), or the fade-in animation replays and the modal flickers.
- **Notes:** `notes` is "My notes" (Noah's own). `aiNotes` is "AI notes": the only notes Claude or any automation should write to.
- **Gender:** use `genderBtns(value, act)`, not a `<select>`. Buttons are black when unset, blue when Male, pink when Female.
- **Mobile:** below 760px there's a bottom nav (`.mnav`) and the sidebar is hidden. Check new UI at 390px width with no horizontal scroll.

## Testing

See `tests/README.md`. Serve the repo over HTTP (`python3 -m http.server 8765`), then run the Playwright scripts. They use the demo data or a fake backend and never touch the real sheet. Run `node -e` on the inline script to catch syntax errors fast:

```bash
node -e "const s=require('fs').readFileSync('index.html','utf8');[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(m=>new Function(m[1]));console.log('ok')"
```

## Backend changes

If you change `apps-script/Code.gs`, tell Noah it needs redeploying, because the cloud can't reach his Apps Script:

1. Open the NAKAMA Contacts sheet → Extensions → Apps Script.
2. Replace everything in `Code.gs` with the new file and save.
3. Deploy → Manage deployments → pencil (Edit) → Version: **New version** → Deploy.

That keeps the same `/exec` URL. A new deployment would change the URL. Only list the steps when the backend actually changed; most work is `index.html` only.

## Git

Author commits as `Noah Ruediger <noah.ruediger@gmail.com>`. The site deploys from `main`.
