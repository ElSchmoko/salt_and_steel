# Salt & Steel

A turn-based age-of-sail strategy game on a hex sea chart, built for one-thumb play on a phone. Start with two ships, found a home port on an island, chart the sea, build up your islands and outlast rival flags.

**Play:** https://elschmoko.github.io/salt_and_steel/

## Files

- `index.html` is the whole game in one file. GitHub Pages serves it as is.
- `src/` holds the same game split into parts: `core.js` (rules, map, AI), `art.js` (drawing), `render.js` (map and scenes), `ui.js` (screens and input), `shell.html` (styles and markup).
- `build.py` rebuilds `index.html` from `src/`.

Saves are kept in the browser's local storage on each device.
