# Uma Musume Trophy Tracker

A static web app for tracking completion of Uma Musume graded races
(G1/G2/G3) across a calendar view, list view, and an in-game-style
Trophy Room view.

## Running it

This is a plain HTML/CSS/JS app with no build step, but it loads data
via `fetch()` (`data/races.json`, `data/trophy-room.json`), so it must
be served over `http://` rather than opened directly as a `file://`
URL, or the fetches will be blocked by the browser.

From this folder, start any static file server, for example:

```bash
python3 -m http.server 8000
```

or, with Node:

```bash
npx serve .
```

Then open **http://localhost:8000** (adjust the port to whatever the
server prints) in your browser.

Your checklist progress is saved automatically to the browser's
`localStorage`, so it persists between sessions on the same browser.
Use the **Export**/**Import** buttons to back up or transfer your
progress as a JSON file, and **Clear** to reset it.

## Importing from game screenshots

**Scan screenshots** reads in-game Trophy Room screenshots and ticks off
the trophies you've already won. Take one screenshot per page; crops are
fine as long as the row of page dots under the shelves is visible. Pick
any number at once, review the detections (click a trophy to correct
it), then **Apply**.

Everything runs in the browser (`trophy-cv.js`, plain canvas pixel
analysis, no ML or uploads):

1. The green page dot gives the page index (G1 → G2 → G3 → EX), and the
   dot spacing gives the screenshot's scale.
2. The 3×5 slot grid is placed relative to the dot row.
3. A slot counts as won if its trophy area contains lit gold/silver
   pixels; unwon trophies are dark silhouettes.

EX pages are recognised but skipped, since the app doesn't track them.

To check detection accuracy against the labelled screenshots in `CV/`:

```bash
node tools/test-cv.js            # Node, using a built-in PNG decoder
```

`tools/browser-test.html` runs the same check through the real browser
canvas path (serve the repo root and open it).

## Refreshing race data

`data/races.json` and `data/trophy-room.json` are generated files, not
meant to be hand-edited:

- `build-data.js` converts a raw gametora `race_instances.json` export
  into `data/races.json`. See the comment at the top of that file for
  the steps to pull fresh source data.
- `build-trophy-room.js` builds `data/trophy-room.json`, which lays
  out those races into the paged Trophy Room order described in
  `umamusume_trophy_room_order.md`. Re-run it after regenerating
  `races.json` if new races were added:

  ```bash
  node build-data.js
  node build-trophy-room.js
  ```
