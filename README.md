# Salt & Steel

A turn-based age-of-sail strategy game on a hex sea chart, built for one-thumb play on a phone. Start with two ships, found a home port on an island, chart the sea, build up your islands and outlast rival flags.

**Play:** https://elschmoko.github.io/salt_and_steel/

**Android:** [download SaltAndSteel.apk](https://github.com/ElSchmoko/salt_and_steel/releases/latest/download/SaltAndSteel.apk). The app opens the game from GitHub Pages on every start, so it updates itself whenever `index.html` changes here. Offline it opens the last version it saw.

## Files

- `index.html` is the whole game in one file. GitHub Pages serves it as is.
- `src/` holds the same game split into parts: `core.js` (rules, map, AI), `art.js` (drawing), `render.js` (map and scenes), `ui.js` (screens and input), `shell.html` (styles and markup).
- `build.py` rebuilds `index.html` from `src/`.
- `android/` is the Android app: a full-screen wrapper around the GitHub Pages game. GitHub Actions builds and publishes the APK on every push that touches it or `index.html` (see `.github/workflows/android.yml`). It is signed with `android/saltandsteel.keystore`, so new builds install over old ones.

Saves are kept in the browser's local storage on each device.
