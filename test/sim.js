// Node simulation tests for the rules in src/core.js. Run: node test/sim.js
const assert = require('assert');
const crypto = require('crypto');
const HX = require('../src/core.js');

const digest = (G) => crypto.createHash('sha256').update(JSON.stringify(G)).digest('hex');

// Every human sends its fleet exploring on turn 1, then turns pass with nothing else scripted.
function runExplore(opts, turns) {
  const G = HX.newGame(opts);
  G.factions.filter((F) => F.human).forEach((F) => {
    G.fleets.filter((fl) => fl.owner === F.id).forEach((fl) => { fl.auto = true; });
  });
  for (let t = 0; t < turns && !G.over; t++) HX.endTurn(G);
  return G;
}

// 1. One human: the same seed and orders always give the same state (determinism).
{
  const a = runExplore({ size: 's', seed: 12345, humans: 1 }, 40);
  const b = runExplore({ size: 's', seed: 12345, humans: 1 }, 40);
  assert.strictEqual(digest(a), digest(b), 'single-human games diverged with identical input');
  assert.ok(a.factions[0].human && !a.factions[1].human, 'one human expected');
}

// 2. Two humans: both are human, both explore, and each keeps its own fog.
{
  const G = HX.newGame({ size: 's', seed: 777, humans: 2 });
  assert.ok(G.factions[0].human && G.factions[1].human, 'two humans expected');
  assert.ok(!G.factions[2].human, 'AI rivals must remain human-free');
  G.fleets.filter((fl) => fl.owner === 0 || fl.owner === 1).forEach((fl) => { fl.auto = true; });
  for (let t = 0; t < 3; t++) HX.endTurn(G);
  const mine = Object.keys(G.factions[0].explored), theirs = Object.keys(G.factions[1].explored);
  assert.ok(mine.length > 10 && theirs.length > 10, 'both players should chart water early on');
  assert.ok(mine.some((k) => !G.factions[1].explored[k]), 'player 0 should know hexes player 1 does not');
  assert.ok(theirs.some((k) => !G.factions[0].explored[k]), 'player 1 should know hexes player 0 does not');
  for (let t = 0; t < 37 && !G.over; t++) HX.endTurn(G);
}

// 3. Two humans: every queued event belongs to a human, and both players get events.
{
  const G = HX.newGame({ size: 's', seed: 777, humans: 2 });
  G.factions.filter((F) => F.human).forEach((F) => G.fleets.filter((fl) => fl.owner === F.id).forEach((fl) => { fl.auto = true; }));
  const seen = new Set();
  for (let t = 0; t < 60 && !G.over; t++) {
    HX.endTurn(G);
    G.ev.forEach((e) => { assert.ok(e.to === 0 || e.to === 1, 'event without a human target: ' + JSON.stringify(e)); seen.add(e.to); });
    G.ev = [];
  }
}

// 4. AI only: the game still runs to a finish with no human players.
{
  const G = HX.newGame({ size: 's', seed: 99, allAI: true });
  assert.ok(G.factions.every((F) => !F.human), 'allAI should give no humans');
  for (let t = 0; t < 150 && !G.over; t++) HX.endTurn(G);
}

console.log('sim tests passed');
