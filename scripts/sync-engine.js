// Copies the shared rules into the Edge Function folder, so the server runs the same code as the browser.
// Run after changing src/core.js or src/match.js: node scripts/sync-engine.js
const fs = require('fs'), path = require('path');
const dest = path.join(__dirname, '..', 'supabase', 'functions', 'match', 'engine');
fs.mkdirSync(dest, { recursive: true });
for (const f of ['core.js', 'match.js']) {
  fs.copyFileSync(path.join(__dirname, '..', 'src', f), path.join(dest, f));
  console.log('copied', f);
}
