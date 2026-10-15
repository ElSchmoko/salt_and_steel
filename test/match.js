// Node tests for the simultaneous-turn match layer. Run: node test/match.js
const assert = require('assert');
const crypto = require('crypto');
const M = require('../src/match.js');

const digest = (x) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fleetsOf = (m, fid) => m.G.fleets.filter((f) => f.owner === fid);

function twoPlayerMatch(seed) {
  const m = M.newMatch({ size: 's', seed, humans: 2 });
  assert.strictEqual(M.joinSeat(m, 0).ok, true);
  assert.strictEqual(M.joinSeat(m, 1).ok, true);
  return m;
}

// 1. Nothing resolves until both players have ended their turn.
{
  const m = twoPlayerMatch(31);
  const t0 = m.G.turn;
  assert.strictEqual(M.endMyTurn(m, 0).resolved, false);
  assert.strictEqual(m.G.turn, t0, 'turn must not advance on one end');
  assert.strictEqual(M.endMyTurn(m, 1).resolved, true);
  assert.strictEqual(m.G.turn, t0 + 1, 'turn advances once both have ended');
  assert.deepStrictEqual(m.ended, {}, 'end flags reset after resolution');
}

// 2. A player cannot order another player's fleet, and bad orders are reported, not applied.
{
  const m = twoPlayerMatch(31);
  const theirs = fleetsOf(m, 1)[0];
  const r = M.submitOrders(m, 0, [{ t: 'explore', fleet: theirs.id }]);
  assert.strictEqual(r.accepted, 0);
  assert.strictEqual(r.rejected.length, 1);
  assert.strictEqual(r.rejected[0].why, 'Not your fleet.');
  assert.deepStrictEqual(m.pending[0] || [], []);
}

// 3. Ending the turn before a seat has joined is refused.
{
  const m = M.newMatch({ size: 's', seed: 31, humans: 2 });
  M.joinSeat(m, 0);
  assert.strictEqual(M.endMyTurn(m, 0).ok, false, 'cannot play alone in a two-seat match');
}

// 4. Same seed and same orders give the same state, so the server and any replay agree.
function play(seed) {
  const m = twoPlayerMatch(seed);
  for (let t = 0; t < 25 && !m.G.over; t++) {
    [0, 1].forEach((fid) => M.submitOrders(m, fid, fleetsOf(m, fid).map((f) => ({ t: 'explore', fleet: f.id }))));
    M.endMyTurn(m, 0); M.endMyTurn(m, 1);
  }
  return m;
}
{
  const a = play(777), b = play(777);
  assert.strictEqual(digest(a.G), digest(b.G), 'same seed and orders must match exactly');
  assert.ok(a.G.turn > 5, 'the match should have advanced');
}

// 5. Each player's view hides the other player's private state and unexplored water.
{
  const m = play(777);
  const v0 = M.viewFor(m, 0);
  const s = v0.state;
  assert.strictEqual(s.rs, null, 'RNG seed must not be sent to clients');
  assert.strictEqual(s.seed, null, 'map seed must not be sent to clients');
  assert.strictEqual(s.factions[1].res, null, 'rival treasury hidden');
  assert.strictEqual(s.factions[1].research, null, 'rival research hidden');
  assert.ok(s.ev.every((e) => e.to === 0), 'only own events are sent');
  for (const k in s.hexes) {
    if (!m.G.factions[0].explored[k]) assert.strictEqual(s.hexes[k].base, undefined, 'no bases on unexplored water: ' + k);
  }
  const rivalFleetsSeen = s.fleets.filter((f) => f.owner === 1).length;
  assert.ok(rivalFleetsSeen <= fleetsOf(m, 1).length, 'no hidden fleets beyond the real count');
}

console.log('match tests passed');
