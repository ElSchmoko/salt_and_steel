/* Match layer for simultaneous multiplayer. Each player sends orders during the turn; the turn resolves
   only when every joined player has ended theirs. Orders are applied in seat order with the same rule
   functions the single-player game uses. Shared by the Node tests and the server function. */
(function (root) {
  'use strict';
  var HX = (typeof module !== 'undefined' && module.exports) ? require('./core.js') : root.HX;

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function fleetById(G, id) { return G.fleets.filter(function (x) { return x.id === id; })[0] || null; }
  function ownTown(G, fid, k) { var h = G.hexes[k], b = h && h.base; return !!(b && b.owner === fid); }

  // Apply one order for player fid to G. Returns {ok, why}. Mutates G.
  function applyOrder(G, fid, o) {
    if (!o || typeof o !== 'object') return { ok: false, why: 'Bad order.' };
    var F = G.factions[fid];
    if (!F || !F.human || !F.alive) return { ok: false, why: 'Not an active player.' };
    switch (o.t) {
      case 'move':
      case 'explore':
      case 'claim': {
        var fl = fleetById(G, o.fleet);
        if (!fl || fl.owner !== fid) return { ok: false, why: 'Not your fleet.' };
        if (o.t === 'move') {
          if (typeof o.dest !== 'string' || !G.hexes[o.dest]) return { ok: false, why: 'No such hex.' };
          return HX.order(G, fl, o.dest, o.sel || null);
        }
        if (o.t === 'explore') { HX.explore(G, fl); return { ok: true }; }
        return HX.claim(G, fl);
      }
      case 'build': {
        if (typeof o.town !== 'string' || !ownTown(G, fid, o.town)) return { ok: false, why: 'Not your port.' };
        return HX.enqueue(G, o.town, o.kind, o.id, o.at || null);
      }
      case 'cancel': {
        if (typeof o.town !== 'string' || !ownTown(G, fid, o.town)) return { ok: false, why: 'Not your port.' };
        return HX.cancelQueue(G, o.town, +o.i) ? { ok: true } : { ok: false, why: 'Nothing to cancel.' };
      }
      case 'found': {
        var c = HX.found(G, fid, o.at);
        return c;
      }
      case 'research': {
        return HX.setResearch(G, fid, o.id) ? { ok: true } : { ok: false, why: 'Cannot study that now.' };
      }
      default:
        return { ok: false, why: 'Unknown order.' };
    }
  }

  // A new match. Seats are the human factions; seat i is faction i. Only seats that have joined play.
  function newMatch(opts) {
    var G = HX.newGame({ size: opts.size || 's', seed: opts.seed, diff: opts.diff || 'normal', humans: opts.humans || 2 });
    var seats = {};
    G.factions.forEach(function (F) { if (F.human) seats[F.id] = false; });
    return { G: G, seats: seats, pending: {}, ended: {}, rejected: {} };
  }

  function joinSeat(m, seat) {
    if (!(seat in m.seats)) return { ok: false, why: 'No such seat.' };
    if (m.seats[seat]) return { ok: false, why: 'Seat taken.' };
    m.seats[seat] = true; return { ok: true };
  }
  function started(m) { return Object.keys(m.seats).every(function (s) { return m.seats[s]; }); }

  // Check orders against a copy of the state so a bad order is refused now, not at resolution.
  function submitOrders(m, fid, orders) {
    if (m.G.over) return { ok: false, why: 'The match is over.' };
    if (!started(m)) return { ok: false, why: 'Waiting for the other player.' };
    if (m.ended[fid]) return { ok: false, why: 'You have already ended this turn.' };
    var accepted = [], rejected = [];
    (orders || []).forEach(function (o) {
      var probe = clone(m.G), r = applyOrder(probe, fid, o);
      if (r && r.ok !== false) accepted.push(o); else rejected.push({ order: o, why: (r && r.why) || 'Refused.' });
    });
    m.pending[fid] = (m.pending[fid] || []).concat(accepted);
    return { ok: true, accepted: accepted.length, rejected: rejected };
  }

  // The player is done. When everyone has ended, the turn resolves.
  function endMyTurn(m, fid) {
    if (m.G.over) return { ok: false, why: 'The match is over.' };
    if (!started(m)) return { ok: false, why: 'Waiting for the other player.' };
    m.ended[fid] = true;
    var all = Object.keys(m.seats).every(function (s) { return m.ended[s]; });
    if (!all) return { ok: true, resolved: false };
    return { ok: true, resolved: resolve(m) };
  }

  // Apply every player's orders in seat order, then run the AI, pirates and the round.
  function resolve(m) {
    var G = m.G;
    m.rejected = {};
    Object.keys(m.seats).map(Number).sort(function (a, b) { return a - b; }).forEach(function (fid) {
      m.rejected[fid] = [];
      (m.pending[fid] || []).forEach(function (o) {
        var r = applyOrder(G, fid, o);
        if (r && r.ok === false) m.rejected[fid].push({ order: o, why: r.why || 'Refused.' });
      });
    });
    HX.endTurn(G);
    m.pending = {}; m.ended = {};
    return true;
  }

  // What player fid may know: their explored sea, the fleets they can see, and their own books.
  function viewFor(m, fid) {
    var G = clone(m.G), F = G.factions[fid];
    var vis = HX.vision(m.G, fid);          // on the real state, so explored hexes are current
    G.seed = null; G.rs = null;             // the RNG seed would let a client predict rolls
    for (var k in G.hexes) {
      if (!m.G.factions[fid].explored[k]) { var h = G.hexes[k]; G.hexes[k] = { q: h.q, r: h.r }; }
    }
    G.fleets = G.fleets.filter(function (fl) { return fl.owner === fid || HX.fleetVisible(m.G, fid, fl, vis); });
    G.factions.forEach(function (O) {
      if (O.id === fid) return;
      O.res = null; O.rp = null; O.research = null; O.ai = null; O.tech = {};
      O.explored = {};
    });
    for (var k2 in G.hexes) { var b2 = G.hexes[k2].base; if (b2 && b2.owner !== fid) b2.queue = []; }
    G.ev = G.ev.filter(function (e) { return e.to === fid; });
    G.log = G.log.filter(function (l) { return l.f === fid || l.f == null || l.f < 0 || l.k === 'war' || l.k === 'diplo' || l.k === 'loss' || (l.key && vis[l.key]); });
    return { you: fid, turn: G.turn, over: G.over, seats: m.seats, ended: m.ended, state: G };
  }

  var api = {
    newMatch: newMatch, joinSeat: joinSeat, started: started, applyOrder: applyOrder,
    submitOrders: submitOrders, endMyTurn: endMyTurn, resolve: resolve, viewFor: viewFor, clone: clone
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MATCH = api;
})(typeof window !== 'undefined' ? window : globalThis);
