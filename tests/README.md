# NAKAMA browser tests

These run the app in headless Chromium against the built-in **demo data** or a **fake backend** (they intercept `script.google.com`). They never touch the real sheet.

```bash
cd tests && npm install            # Playwright + Leaflet (served locally to the page)
npx playwright install chromium    # or point CHROMIUM=/path/to/chrome at an existing Chromium
(cd .. && python3 -m http.server 8765 &)   # the romaji worker needs http://, not file://
node features.js        # dashboard, drawer, profile, link chat, matcher, settings, random, photo inbox, map, canvas, mobile widths
node merge-notes.js     # My notes / AI notes, Merge duplicate, name choice when linking
node matcher-photos.js  # romaji, undo/un-ignore, gender buttons, photo inbox search + save
node live-merge.js      # fake backend: merge sends mergeContacts then saveContact
node live-photos.js     # fake backend: inbox loading bars, savePhoto, unlinkChat
```

Each prints `OK`/`FAIL` per step and any page errors. Screenshots go to `$OUT` (default: the system temp folder). A single `Failed to load resource: net::ERR_FAILED` is expected: map tiles and fonts are blocked on purpose.
