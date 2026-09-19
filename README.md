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
